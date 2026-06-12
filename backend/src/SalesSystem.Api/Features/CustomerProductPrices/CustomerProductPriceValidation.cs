namespace SalesSystem.Api.Features.CustomerProductPrices;

internal static class CustomerProductPriceValidation
{
    public static Dictionary<string, string[]> ValidateCreateCustomerProductPrice(
        CreateCustomerProductPriceRequest request)
    {
        var errors = ValidatePriceFields(request.UnitPrice, request.EffectiveFrom);

        if (request.CustomerId <= 0)
        {
            errors[nameof(request.CustomerId)] = ["得意先IDは1以上で指定してください。"];
        }

        if (request.ProductId <= 0)
        {
            errors[nameof(request.ProductId)] = ["商品IDは1以上で指定してください。"];
        }

        return errors;
    }

    public static Dictionary<string, string[]> ValidateChangeCustomerProductPrice(
        long customerId,
        long productId,
        ChangeCustomerProductPriceRequest request)
    {
        var errors = ValidatePriceFields(request.UnitPrice, request.EffectiveFrom);

        if (customerId <= 0)
        {
            errors[nameof(customerId)] = ["得意先IDは1以上で指定してください。"];
        }

        if (productId <= 0)
        {
            errors[nameof(productId)] = ["商品IDは1以上で指定してください。"];
        }

        return errors;
    }

    public static Dictionary<string, string[]> ValidateListFilters(long? customerId, long? productId)
    {
        var errors = new Dictionary<string, string[]>();

        if (customerId is <= 0)
        {
            errors[nameof(customerId)] = ["得意先IDは1以上で指定してください。"];
        }

        if (productId is <= 0)
        {
            errors[nameof(productId)] = ["商品IDは1以上で指定してください。"];
        }

        return errors;
    }

    public static Dictionary<string, string[]> ValidatePreview(long customerId, long productId, DateTime? asOf)
    {
        var errors = new Dictionary<string, string[]>();

        if (customerId <= 0)
        {
            errors[nameof(customerId)] = ["得意先IDは1以上で指定してください。"];
        }

        if (productId <= 0)
        {
            errors[nameof(productId)] = ["商品IDは1以上で指定してください。"];
        }

        if (asOf is { } value && value == default)
        {
            errors["asOf"] = ["対象日は必須です。"];
        }

        return errors;
    }

    private static Dictionary<string, string[]> ValidatePriceFields(decimal unitPrice, DateTime effectiveFrom)
    {
        var errors = new Dictionary<string, string[]>();

        if (unitPrice < 0)
        {
            errors[nameof(CreateCustomerProductPriceRequest.UnitPrice)] = ["単価は0以上で指定してください。"];
        }
        else if (decimal.Round(unitPrice, 2) != unitPrice)
        {
            errors[nameof(CreateCustomerProductPriceRequest.UnitPrice)] = ["単価は小数2桁までで指定してください。"];
        }

        if (effectiveFrom == default)
        {
            errors[nameof(CreateCustomerProductPriceRequest.EffectiveFrom)] = ["適用開始日は必須です。"];
        }

        return errors;
    }
}
