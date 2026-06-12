using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SalesSystem.Api.Auth;
using SalesSystem.Api.Domain.Entities;
using SalesSystem.Api.Features.Shared;
using SalesSystem.Api.Persistence;

namespace SalesSystem.Api.Features.Sales;

public static class SaleEndpoints
{
    public static IEndpointRouteBuilder MapSaleEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/sales");

        group.MapPost("/", CreateSale)
            .RequireAuthorization(AuthorizationPolicies.MasterMaintainer);

        group.MapPost("/{saleId:long}/cancel", CancelSale)
            .RequireAuthorization(AuthorizationPolicies.MasterMaintainer);

        group.MapGet("/", GetSales)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapGet("/line-preview", LinePreview)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapGet("/{saleId:long}", GetSale)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        return endpoints;
    }

    private static async Task<IResult> CreateSale(
        AppDbContext dbContext,
        CreateSaleRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var errors = SaleValidation.ValidateCreateSale(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var salesDate = request.SalesDate.Date;
        var lines = request.Lines!;

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var customer = await LoadCustomerAsync(dbContext, request.CustomerId, salesDate, cancellationToken);
        if (customer is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Results.NotFound(new { message = "指定日時点で利用できる得意先情報がありません。" });
        }

        var resolvedLines = await ResolveSalesLinesAsync(
            dbContext,
            customer.CustomerId,
            lines.Select(line => line.ProductId).ToList(),
            salesDate,
            cancellationToken);

        foreach (var resolvedLine in resolvedLines)
        {
            if (resolvedLine.ErrorMessage is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
                return BuildSalesLineResolutionErrorResult(resolvedLine);
            }

            if (resolvedLine.IsDiscontinued)
            {
                await transaction.RollbackAsync(cancellationToken);
                return Results.Conflict(new { message = "販売停止中の商品は登録できません。" });
            }
        }

        var now = DateTime.UtcNow;
        var changedBy = GetUserName(user);

        var sale = new Sale
        {
            SalesDate = salesDate,
            CustomerId = customer.CustomerId,
            CustomerVersionId = customer.CustomerVersion.CustomerVersionId,
            CreatedAt = now
        };

        decimal totalAmount = 0m;

        for (var index = 0; index < lines.Count; index++)
        {
            var line = lines[index];
            var resolvedLine = resolvedLines[index];

            var amount = decimal.Round(line.Quantity * line.UnitPrice, 2, MidpointRounding.AwayFromZero);
            var taxAmount = decimal.Floor(amount * resolvedLine.TaxRate);
            var isManualUnitPrice = line.UnitPrice != resolvedLine.AutoUnitPrice;

            if (!isManualUnitPrice && !string.IsNullOrWhiteSpace(line.ManualUnitPriceReason))
            {
                await transaction.RollbackAsync(cancellationToken);
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    [$"Lines[{index}].{nameof(CreateSaleLineRequest.ManualUnitPriceReason)}"] = ["手入力変更理由は単価を自動取得単価から変更した場合だけ指定できます。"]
                });
            }

            var manualReason = isManualUnitPrice && !string.IsNullOrWhiteSpace(line.ManualUnitPriceReason)
                ? line.ManualUnitPriceReason.Trim()
                : null;

            sale.Details.Add(new SaleDetail
            {
                ProductId = resolvedLine.ProductId,
                ProductVersionId = resolvedLine.ProductVersionId,
                TaxRateId = resolvedLine.TaxRateId,
                TaxCategory = resolvedLine.TaxCategory,
                TaxCategoryName = resolvedLine.TaxCategoryName,
                AccountingCategory = resolvedLine.AccountingCategory,
                Quantity = line.Quantity,
                UnitPrice = line.UnitPrice,
                CustomerProductPriceId = resolvedLine.CustomerProductPriceId,
                IsManualUnitPrice = isManualUnitPrice,
                AutoUnitPrice = resolvedLine.AutoUnitPrice,
                ManualUnitPriceReason = manualReason,
                TaxRate = resolvedLine.TaxRate,
                TaxAmount = taxAmount,
                Amount = amount
            });

            totalAmount += amount + taxAmount;
        }

        sale.TotalAmount = totalAmount;
        sale.StatusHistories.Add(new SaleStatusHistory
        {
            Status = SaleStatus.Active,
            Reason = "売上登録",
            ChangedAt = now,
            ChangedBy = changedBy
        });
        dbContext.Sales.Add(sale);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Results.Conflict(new { message = "売上の登録に失敗しました。" });
        }

        var response = await BuildSaleResponse(dbContext, sale.Id, cancellationToken);
        return Results.Created($"/api/sales/{sale.Id}", response);
    }

    private static async Task<IResult> CancelSale(
        AppDbContext dbContext,
        long saleId,
        CancelSaleRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var errors = SaleValidation.ValidateCancelSale(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var sale = await dbContext.Sales
            .Include(sale => sale.Details)
            .FirstOrDefaultAsync(sale => sale.Id == saleId, cancellationToken);

        if (sale is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Results.NotFound(new { message = "売上が見つかりません。" });
        }

        var latestStatus = await LoadLatestStatusAsync(dbContext, saleId, cancellationToken);
        if (latestStatus?.Status == SaleStatus.Canceled)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Results.Conflict(new { message = "既に取消済みの売上は取り消せません。" });
        }

        var isCorrectionSale = await dbContext.SaleCorrections
            .AnyAsync(correction => correction.CorrectionSaleId == saleId, cancellationToken);
        if (isCorrectionSale)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Results.Conflict(new { message = "取消売上は取り消せません。" });
        }

        var now = DateTime.UtcNow;
        var changedBy = GetUserName(user);
        var reason = request.Reason!.Trim();

        dbContext.SaleStatusHistories.Add(new SaleStatusHistory
        {
            SaleId = sale.Id,
            Status = SaleStatus.Canceled,
            Reason = reason,
            ChangedAt = now,
            ChangedBy = changedBy
        });

        var cancellationSale = new Sale
        {
            SalesDate = sale.SalesDate,
            CustomerId = sale.CustomerId,
            CustomerVersionId = sale.CustomerVersionId,
            TotalAmount = -sale.TotalAmount,
            CreatedAt = now
        };

        foreach (var detail in sale.Details.OrderBy(detail => detail.Id))
        {
            cancellationSale.Details.Add(new SaleDetail
            {
                ProductId = detail.ProductId,
                ProductVersionId = detail.ProductVersionId,
                TaxRateId = detail.TaxRateId,
                TaxCategory = detail.TaxCategory,
                TaxCategoryName = detail.TaxCategoryName,
                AccountingCategory = detail.AccountingCategory,
                Quantity = -detail.Quantity,
                UnitPrice = detail.UnitPrice,
                CustomerProductPriceId = detail.CustomerProductPriceId,
                IsManualUnitPrice = detail.IsManualUnitPrice,
                AutoUnitPrice = detail.AutoUnitPrice,
                ManualUnitPriceReason = detail.ManualUnitPriceReason,
                TaxRate = detail.TaxRate,
                TaxAmount = -detail.TaxAmount,
                Amount = -detail.Amount
            });
        }

        cancellationSale.StatusHistories.Add(new SaleStatusHistory
        {
            Status = SaleStatus.Active,
            Reason = reason,
            ChangedAt = now,
            ChangedBy = changedBy
        });

        dbContext.Sales.Add(cancellationSale);
        dbContext.SaleCorrections.Add(new SaleCorrection
        {
            OriginalSaleId = sale.Id,
            CorrectionSale = cancellationSale,
            CorrectionType = SaleCorrectionType.Cancellation,
            Reason = reason,
            CreatedAt = now,
            CreatedBy = changedBy
        });

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Results.Conflict(new { message = "売上の取消に失敗しました。" });
        }

        var response = await BuildSaleResponse(dbContext, sale.Id, cancellationToken);
        return Results.Ok(response);
    }

    private static async Task<IResult> GetSales(
        AppDbContext dbContext,
        DateTime? salesDateFrom,
        DateTime? salesDateTo,
        long? customerId,
        string? customerCode,
        bool? includeCanceled,
        bool? includeCorrections,
        CancellationToken cancellationToken)
    {
        var query =
            from sale in dbContext.Sales.AsNoTracking()
            join customer in dbContext.Customers.AsNoTracking()
                on sale.CustomerId equals customer.Id
            join customerVersion in dbContext.CustomerVersions.AsNoTracking()
                on new
                {
                    CustomerVersionId = sale.CustomerVersionId,
                    CustomerId = sale.CustomerId
                }
                equals new
                {
                    CustomerVersionId = customerVersion.Id,
                    CustomerId = customerVersion.CustomerId
                }
            select new { sale, customer, customerVersion };

        if (salesDateFrom is not null && salesDateFrom != default)
        {
            var from = salesDateFrom.Value.Date;
            query = query.Where(item => item.sale.SalesDate >= from);
        }

        if (salesDateTo is not null && salesDateTo != default)
        {
            var to = salesDateTo.Value.Date;
            query = query.Where(item => item.sale.SalesDate <= to);
        }

        if (customerId is not null && customerId > 0)
        {
            query = query.Where(item => item.sale.CustomerId == customerId.Value);
        }

        if (!string.IsNullOrWhiteSpace(customerCode))
        {
            query = query.Where(item => item.customer.CustomerCode.Contains(customerCode));
        }

        var rows = await query
            .OrderByDescending(item => item.sale.SalesDate)
            .ThenByDescending(item => item.sale.Id)
            .ToListAsync(cancellationToken);

        var saleIds = rows.Select(item => item.sale.Id).ToList();
        var latestStatuses = await LoadLatestStatusesAsync(dbContext, saleIds, cancellationToken);
        var corrections = await dbContext.SaleCorrections
            .AsNoTracking()
            .Where(correction => saleIds.Contains(correction.CorrectionSaleId)
                || saleIds.Contains(correction.OriginalSaleId))
            .ToListAsync(cancellationToken);
        var correctionsByCorrectionSaleId = corrections.ToDictionary(correction => correction.CorrectionSaleId);
        var correctionsByOriginalSaleId = corrections
            .GroupBy(correction => correction.OriginalSaleId)
            .ToDictionary(group => group.Key, group => group.First());

        var sales = rows
            .Where(item => latestStatuses.TryGetValue(item.sale.Id, out var status)
                && (includeCanceled == true || status.Status == SaleStatus.Active)
                && (includeCorrections == true || !correctionsByCorrectionSaleId.ContainsKey(item.sale.Id)))
            .Select(item =>
            {
                var status = latestStatuses[item.sale.Id];
                correctionsByCorrectionSaleId.TryGetValue(item.sale.Id, out var inboundCorrection);
                correctionsByOriginalSaleId.TryGetValue(item.sale.Id, out var outboundCorrection);
                var correction = inboundCorrection ?? outboundCorrection;
                return new SaleListItemResponse(
                    item.sale.Id,
                    item.sale.SalesDate,
                    item.customer.Id,
                    item.customer.CustomerCode,
                    item.customerVersion.Name,
                    item.sale.TotalAmount,
                    item.sale.CreatedAt,
                    status.Status.ToString(),
                    status.ChangedAt,
                    correction?.CorrectionType.ToString(),
                    inboundCorrection?.OriginalSaleId,
                    correction?.CorrectionSaleId,
                    correction?.Reason);
            })
            .ToList();

        return Results.Ok(sales);
    }

    private static async Task<IResult> GetSale(
        AppDbContext dbContext,
        long saleId,
        CancellationToken cancellationToken)
    {
        var response = await BuildSaleResponse(dbContext, saleId, cancellationToken);
        return response is null
            ? Results.NotFound(new { message = "売上が見つかりません。" })
            : Results.Ok(response);
    }

    private static async Task<IResult> LinePreview(
        AppDbContext dbContext,
        long customerId,
        long productId,
        DateTime salesDate,
        CancellationToken cancellationToken)
    {
        if (salesDate == default)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                [nameof(salesDate)] = ["売上日は必須です。"]
            });
        }

        var date = salesDate.Date;
        var customer = await LoadCustomerAsync(dbContext, customerId, date, cancellationToken);
        if (customer is null)
        {
            return Results.NotFound(new { message = "指定日時点で利用できる得意先情報がありません。" });
        }

        var resolvedLine = await ResolveSalesLineAsync(dbContext, customer.CustomerId, productId, date, cancellationToken);
        if (resolvedLine.ErrorMessage is not null)
        {
            return BuildSalesLineResolutionErrorResult(resolvedLine);
        }

        return Results.Ok(new SalesLinePreviewResponse(
            resolvedLine.ProductId,
            resolvedLine.ProductCode,
            resolvedLine.Name,
            resolvedLine.Unit,
            resolvedLine.AutoUnitPrice,
            ResolveUnitPriceSource(resolvedLine.CustomerProductPriceId),
            resolvedLine.TaxCategory,
            resolvedLine.TaxCategoryName,
            resolvedLine.AccountingCategory,
            resolvedLine.TaxRate,
            resolvedLine.IsDiscontinued));
    }

    private static async Task<SaleResponse?> BuildSaleResponse(
        AppDbContext dbContext,
        long saleId,
        CancellationToken cancellationToken)
    {
        var header = await (
            from sale in dbContext.Sales.AsNoTracking()
            join customer in dbContext.Customers.AsNoTracking()
                on sale.CustomerId equals customer.Id
            join customerVersion in dbContext.CustomerVersions.AsNoTracking()
                on new
                {
                    CustomerVersionId = sale.CustomerVersionId,
                    CustomerId = sale.CustomerId
                }
                equals new
                {
                    CustomerVersionId = customerVersion.Id,
                    CustomerId = customerVersion.CustomerId
                }
            where sale.Id == saleId
            select new
            {
                sale.Id,
                sale.SalesDate,
                sale.CustomerId,
                customer.CustomerCode,
                sale.CustomerVersionId,
                CustomerName = customerVersion.Name,
                sale.TotalAmount,
                sale.CreatedAt
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (header is null)
        {
            return null;
        }

        var details = await (
            from detail in dbContext.SaleDetails.AsNoTracking()
            join product in dbContext.Products.AsNoTracking()
                on detail.ProductId equals product.Id
            join productVersion in dbContext.ProductVersions.AsNoTracking()
                on new
                {
                    ProductVersionId = detail.ProductVersionId,
                    ProductId = detail.ProductId
                }
                equals new
                {
                    ProductVersionId = productVersion.Id,
                    ProductId = productVersion.ProductId
                }
            where detail.SaleId == saleId
            orderby detail.Id
            select new SaleDetailLineResponse(
                detail.Id,
                detail.ProductId,
                product.ProductCode,
                productVersion.Name,
                productVersion.Unit,
                detail.TaxCategory,
                detail.TaxCategoryName,
                detail.AccountingCategory,
                detail.Quantity,
                detail.UnitPrice,
                detail.CustomerProductPriceId == null
                    ? UnitPriceSources.ProductStandard
                    : UnitPriceSources.CustomerProductPrice,
                detail.IsManualUnitPrice,
                detail.AutoUnitPrice,
                detail.ManualUnitPriceReason,
                detail.TaxRate,
                detail.TaxAmount,
                detail.Amount))
            .ToListAsync(cancellationToken);

        var latestStatus = await LoadLatestStatusAsync(dbContext, saleId, cancellationToken);
        var statusHistories = await dbContext.SaleStatusHistories
            .AsNoTracking()
            .Where(history => history.SaleId == saleId)
            .OrderBy(history => history.ChangedAt)
            .ThenBy(history => history.Id)
            .Select(history => new SaleStatusHistoryResponse(
                history.Status.ToString(),
                history.Reason,
                history.ChangedAt,
                history.ChangedBy))
            .ToListAsync(cancellationToken);

        var correction = await dbContext.SaleCorrections
            .AsNoTracking()
            .Where(correction => correction.CorrectionSaleId == saleId
                || correction.OriginalSaleId == saleId)
            .FirstOrDefaultAsync(cancellationToken);

        long? originalSaleId = correction?.CorrectionSaleId == saleId ? correction.OriginalSaleId : null;

        return new SaleResponse(
            header.Id,
            header.SalesDate,
            header.CustomerId,
            header.CustomerCode,
            header.CustomerName,
            header.TotalAmount,
            header.CreatedAt,
            latestStatus?.Status.ToString() ?? SaleStatus.Active.ToString(),
            latestStatus?.ChangedAt ?? header.CreatedAt,
            correction?.CorrectionType.ToString(),
            originalSaleId,
            correction?.CorrectionSaleId,
            correction?.Reason,
            correction?.CreatedBy,
            statusHistories,
            details);
    }

    private static async Task<SaleStatusHistory?> LoadLatestStatusAsync(
        AppDbContext dbContext,
        long saleId,
        CancellationToken cancellationToken)
    {
        return await dbContext.SaleStatusHistories
            .AsNoTracking()
            .Where(history => history.SaleId == saleId)
            .OrderByDescending(history => history.ChangedAt)
            .ThenByDescending(history => history.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static async Task<Dictionary<long, SaleStatusHistory>> LoadLatestStatusesAsync(
        AppDbContext dbContext,
        List<long> saleIds,
        CancellationToken cancellationToken)
    {
        var histories = await dbContext.SaleStatusHistories
            .AsNoTracking()
            .Where(history => saleIds.Contains(history.SaleId))
            .OrderByDescending(history => history.ChangedAt)
            .ThenByDescending(history => history.Id)
            .ToListAsync(cancellationToken);

        return histories
            .GroupBy(history => history.SaleId)
            .ToDictionary(group => group.Key, group => group.First());
    }

    private static string GetUserName(ClaimsPrincipal user)
    {
        return user.Identity?.Name?.Trim() is { Length: > 0 } name ? name : "unknown";
    }

    private static string ResolveUnitPriceSource(long? customerProductPriceId)
    {
        return customerProductPriceId is null
            ? UnitPriceSources.ProductStandard
            : UnitPriceSources.CustomerProductPrice;
    }

    private static IResult BuildSalesLineResolutionErrorResult(SalesLineResolution resolvedLine)
    {
        return resolvedLine.ErrorKind switch
        {
            SalesLineResolutionErrorKind.ProductNotFound => Results.NotFound(new { message = resolvedLine.ErrorMessage }),
            SalesLineResolutionErrorKind.ProductVersionNotFound => Results.NotFound(new { message = resolvedLine.ErrorMessage }),
            SalesLineResolutionErrorKind.TaxRateNotFound => Results.NotFound(new { message = resolvedLine.ErrorMessage }),
            _ => Results.NotFound(new { message = resolvedLine.ErrorMessage })
        };
    }

    private static async Task<SalesLineResolution> ResolveSalesLineAsync(
        AppDbContext dbContext,
        long customerId,
        long productId,
        DateTime salesDate,
        CancellationToken cancellationToken)
    {
        var resolvedLines = await ResolveSalesLinesAsync(
            dbContext,
            customerId,
            [productId],
            salesDate,
            cancellationToken);

        return resolvedLines[0];
    }

    private static async Task<List<SalesLineResolution>> ResolveSalesLinesAsync(
        AppDbContext dbContext,
        long customerId,
        List<long> productIds,
        DateTime salesDate,
        CancellationToken cancellationToken)
    {
        var distinctProductIds = productIds.Distinct().ToList();

        var products = await dbContext.Products
            .AsNoTracking()
            .Where(product => distinctProductIds.Contains(product.Id))
            .Select(product => new { product.Id, product.ProductCode })
            .ToListAsync(cancellationToken);
        var productsById = products.ToDictionary(product => product.Id);

        var productVersions = await dbContext.ProductVersions
            .AsNoTracking()
            .Where(version => distinctProductIds.Contains(version.ProductId) && version.ValidFrom <= salesDate)
            .OrderByDescending(version => version.ValidFrom)
            .ThenByDescending(version => version.Id)
            .ToListAsync(cancellationToken);
        var latestProductVersionsByProductId = productVersions
            .GroupBy(version => version.ProductId)
            .ToDictionary(group => group.Key, group => group.First());

        var taxCategories = latestProductVersionsByProductId.Values
            .Select(version => version.TaxCategory)
            .Distinct()
            .ToList();

        var taxRates = await dbContext.TaxRates
            .AsNoTracking()
            .Where(rate => taxCategories.Contains(rate.TaxCategory) && rate.ValidFrom <= salesDate)
            .OrderByDescending(rate => rate.ValidFrom)
            .ThenByDescending(rate => rate.Id)
            .ToListAsync(cancellationToken);
        var latestTaxRatesByCategory = taxRates
            .GroupBy(rate => rate.TaxCategory)
            .ToDictionary(group => group.Key, group => group.First());

        var customerProductPrices = await dbContext.CustomerProductPrices
            .AsNoTracking()
            .Where(price => price.CustomerId == customerId
                && distinctProductIds.Contains(price.ProductId)
                && price.ValidFrom <= salesDate)
            .OrderByDescending(price => price.ValidFrom)
            .ThenByDescending(price => price.Id)
            .ToListAsync(cancellationToken);
        var latestCustomerProductPricesByProductId = customerProductPrices
            .GroupBy(price => price.ProductId)
            .ToDictionary(group => group.Key, group => group.First());

        var resolvedLines = new List<SalesLineResolution>();
        foreach (var productId in productIds)
        {
            if (!productsById.TryGetValue(productId, out var product))
            {
                resolvedLines.Add(SalesLineResolution.Failed(SalesLineResolutionErrorKind.ProductNotFound, "指定日時点で利用できる商品情報がありません。"));
                continue;
            }

            if (!latestProductVersionsByProductId.TryGetValue(productId, out var productVersion))
            {
                resolvedLines.Add(SalesLineResolution.Failed(SalesLineResolutionErrorKind.ProductVersionNotFound, "指定日時点で利用できる商品情報がありません。"));
                continue;
            }

            if (!latestTaxRatesByCategory.TryGetValue(productVersion.TaxCategory, out var taxRate))
            {
                resolvedLines.Add(SalesLineResolution.Failed(SalesLineResolutionErrorKind.TaxRateNotFound, "指定日時点で利用できる税率情報がありません。"));
                continue;
            }

            latestCustomerProductPricesByProductId.TryGetValue(productId, out var customerProductPrice);
            resolvedLines.Add(SalesLineResolution.Succeeded(
                product.Id,
                product.ProductCode,
                productVersion.Id,
                productVersion.Name,
                productVersion.Unit,
                customerProductPrice?.UnitPrice ?? productVersion.StandardUnitPrice,
                customerProductPrice?.Id,
                taxRate.TaxCategory,
                taxRate.TaxCategoryName,
                taxRate.AccountingCategory,
                taxRate.Rate,
                taxRate.Id,
                productVersion.IsDiscontinued,
                productVersion.ValidFrom));
        }

        return resolvedLines;
    }

    private enum SalesLineResolutionErrorKind
    {
        None,
        ProductNotFound,
        ProductVersionNotFound,
        TaxRateNotFound
    }

    private sealed record SalesLineResolution(
        long ProductId,
        string ProductCode,
        long ProductVersionId,
        string Name,
        string Unit,
        decimal AutoUnitPrice,
        long? CustomerProductPriceId,
        string TaxCategory,
        string TaxCategoryName,
        string AccountingCategory,
        decimal TaxRate,
        long TaxRateId,
        bool IsDiscontinued,
        DateTime ProductVersionValidFrom,
        SalesLineResolutionErrorKind ErrorKind,
        string? ErrorMessage)
    {
        public static SalesLineResolution Succeeded(
            long productId,
            string productCode,
            long productVersionId,
            string name,
            string unit,
            decimal autoUnitPrice,
            long? customerProductPriceId,
            string taxCategory,
            string taxCategoryName,
            string accountingCategory,
            decimal taxRate,
            long taxRateId,
            bool isDiscontinued,
            DateTime productVersionValidFrom)
        {
            return new SalesLineResolution(
                productId,
                productCode,
                productVersionId,
                name,
                unit,
                autoUnitPrice,
                customerProductPriceId,
                taxCategory,
                taxCategoryName,
                accountingCategory,
                taxRate,
                taxRateId,
                isDiscontinued,
                productVersionValidFrom,
                SalesLineResolutionErrorKind.None,
                null);
        }

        public static SalesLineResolution Failed(SalesLineResolutionErrorKind errorKind, string errorMessage)
        {
            return new SalesLineResolution(
                0,
                string.Empty,
                0,
                string.Empty,
                string.Empty,
                0,
                null,
                string.Empty,
                string.Empty,
                string.Empty,
                0,
                0,
                false,
                default,
                errorKind,
                errorMessage);
        }
    }

    private sealed record CustomerVersionSnapshot(
        long CustomerVersionId,
        long CustomerId,
        string CustomerCode,
        string Name,
        string Address,
        string PhoneNumber,
        DateTime ValidFrom);

    private sealed record CustomerIdentity(long CustomerId, CustomerVersionSnapshot CustomerVersion);

    private static async Task<CustomerIdentity?> LoadCustomerAsync(
        AppDbContext dbContext,
        long customerId,
        DateTime salesDate,
        CancellationToken cancellationToken)
    {
        var customer = await dbContext.Customers
            .AsNoTracking()
            .Where(customer => customer.Id == customerId)
            .Select(customer => new { customer.Id, customer.CustomerCode })
            .FirstOrDefaultAsync(cancellationToken);

        if (customer is null)
        {
            return null;
        }

        var version = await dbContext.CustomerVersions
            .AsNoTracking()
            .Where(version => version.CustomerId == customerId && version.ValidFrom <= salesDate)
            .OrderByDescending(version => version.ValidFrom)
            .ThenByDescending(version => version.Id)
            .Select(version => new CustomerVersionSnapshot(
                version.Id,
                version.CustomerId,
                customer.CustomerCode,
                version.Name,
                version.Address,
                version.PhoneNumber,
                version.ValidFrom))
            .FirstOrDefaultAsync(cancellationToken);

        return version is null ? null : new CustomerIdentity(customer.Id, version);
    }

    private static async Task<Dictionary<long, ProductVersion>> LoadLatestProductVersionsAsync(
        AppDbContext dbContext,
        List<long> productIds,
        DateTime salesDate,
        CancellationToken cancellationToken)
    {
        var versions = await dbContext.ProductVersions
            .AsNoTracking()
            .Where(version => productIds.Contains(version.ProductId) && version.ValidFrom <= salesDate)
            .OrderByDescending(version => version.ValidFrom)
            .ThenByDescending(version => version.Id)
            .ToListAsync(cancellationToken);

        return versions
            .GroupBy(version => version.ProductId)
            .ToDictionary(group => group.Key, group => group.First());
    }

    private static async Task<Dictionary<string, TaxRate>> LoadLatestTaxRatesAsync(
        AppDbContext dbContext,
        List<string> taxCategories,
        DateTime salesDate,
        CancellationToken cancellationToken)
    {
        var taxRates = await dbContext.TaxRates
            .AsNoTracking()
            .Where(rate => taxCategories.Contains(rate.TaxCategory) && rate.ValidFrom <= salesDate)
            .OrderByDescending(rate => rate.ValidFrom)
            .ThenByDescending(rate => rate.Id)
            .ToListAsync(cancellationToken);

        return taxRates
            .GroupBy(rate => rate.TaxCategory)
            .ToDictionary(group => group.Key, group => group.First());
    }
}
