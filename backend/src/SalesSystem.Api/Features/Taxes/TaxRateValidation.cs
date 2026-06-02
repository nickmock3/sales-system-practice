namespace SalesSystem.Api.Features.Taxes;

internal static class TaxRateValidation
{
    public static Dictionary<string, string[]> ValidateCreateTaxRate(CreateTaxRateRequest request)
    {
        var errors = new Dictionary<string, string[]>();

        AddRequiredString(errors, nameof(request.TaxCategory), request.TaxCategory, 30);

        if (request.Rate < 0)
        {
            errors[nameof(request.Rate)] = ["税率は0以上で指定してください。"];
        }
        else if (request.Rate > 9.9999m)
        {
            errors[nameof(request.Rate)] = ["税率は9.9999以下で指定してください。"];
        }
        else if (decimal.Round(request.Rate, 4) != request.Rate)
        {
            errors[nameof(request.Rate)] = ["税率は小数4桁までで指定してください。"];
        }

        if (request.ValidFrom == default)
        {
            errors[nameof(request.ValidFrom)] = ["適用開始日は必須です。"];
        }

        return errors;
    }

    private static void AddRequiredString(
        Dictionary<string, string[]> errors,
        string fieldName,
        string? value,
        int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors[fieldName] = ["必須です。"];
            return;
        }

        if (value.Length > maxLength)
        {
            errors[fieldName] = [$"{maxLength}文字以内で指定してください。"];
        }
    }
}
