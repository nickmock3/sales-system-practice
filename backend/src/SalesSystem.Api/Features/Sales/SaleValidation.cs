namespace SalesSystem.Api.Features.Sales;

internal static class SaleValidation
{
    public static Dictionary<string, string[]> ValidateCreateSale(CreateSaleRequest request)
    {
        var errors = new Dictionary<string, string[]>();

        if (request.SalesDate == default)
        {
            errors[nameof(request.SalesDate)] = ["売上日は必須です。"];
        }

        if (request.CustomerId <= 0)
        {
            errors[nameof(request.CustomerId)] = ["得意先IDは必須です。"];
        }

        if (request.Lines is null || request.Lines.Count == 0)
        {
            errors[nameof(request.Lines)] = ["明細は1行以上必須です。"];
            return errors;
        }

        for (var index = 0; index < request.Lines.Count; index++)
        {
            var line = request.Lines[index];
            ValidateLine(errors, line, index);
        }

        return errors;
    }

    private static void ValidateLine(
        Dictionary<string, string[]> errors,
        CreateSaleLineRequest line,
        int index)
    {
        var productKey = $"Lines[{index}].{nameof(CreateSaleLineRequest.ProductId)}";
        var quantityKey = $"Lines[{index}].{nameof(CreateSaleLineRequest.Quantity)}";
        var unitPriceKey = $"Lines[{index}].{nameof(CreateSaleLineRequest.UnitPrice)}";

        if (line.ProductId <= 0)
        {
            errors[productKey] = ["商品IDは必須です。"];
        }

        if (line.Quantity <= 0)
        {
            errors[quantityKey] = ["数量は0より大きく指定してください。"];
        }
        else if (decimal.Round(line.Quantity, 3) != line.Quantity)
        {
            errors[quantityKey] = ["数量は小数3桁までで指定してください。"];
        }

        if (line.UnitPrice < 0)
        {
            errors[unitPriceKey] = ["単価は0以上で指定してください。"];
        }
        else if (decimal.Round(line.UnitPrice, 2) != line.UnitPrice)
        {
            errors[unitPriceKey] = ["単価は小数2桁までで指定してください。"];
        }
    }
}
