namespace SalesSystem.Api.Features.Taxes;

internal sealed record TaxCategoryDefinition(
    string Code,
    string Name,
    string AccountingCategory,
    bool RequiresZeroRate);

internal static class TaxCategories
{
    private static readonly Dictionary<string, TaxCategoryDefinition> Definitions = new(StringComparer.Ordinal)
    {
        ["STANDARD"] = new TaxCategoryDefinition("STANDARD", "標準税率", "TAXABLE_STANDARD", false),
        ["REDUCED"] = new TaxCategoryDefinition("REDUCED", "軽減税率", "TAXABLE_REDUCED", false),
        ["NON_TAXABLE"] = new TaxCategoryDefinition("NON_TAXABLE", "非課税", "NON_TAXABLE", true),
        ["TAX_EXEMPT"] = new TaxCategoryDefinition("TAX_EXEMPT", "免税", "TAX_EXEMPT", true),
        ["OLD_STANDARD"] = new TaxCategoryDefinition("OLD_STANDARD", "旧標準税率", "TAXABLE_OLD_STANDARD", false)
    };

    public static bool TryGet(string taxCategory, out TaxCategoryDefinition definition)
    {
        return Definitions.TryGetValue(taxCategory, out definition!);
    }
}

internal static class TaxRateValidation
{
    public static Dictionary<string, string[]> ValidateChangeTaxRate(
        string taxCategory,
        ChangeTaxRateRequest request)
    {
        var errors = new Dictionary<string, string[]>();

        TaxCategoryDefinition? taxCategoryDefinition = null;
        if (string.IsNullOrWhiteSpace(taxCategory))
        {
            errors["taxCategory"] = ["税区分は必須です。"];
        }
        else if (taxCategory.Length > 30)
        {
            errors["taxCategory"] = ["30文字以内で指定してください。"];
        }
        else if (!TaxCategories.TryGet(taxCategory.Trim(), out taxCategoryDefinition))
        {
            errors["taxCategory"] = ["未知の税区分です。"];
        }

        ValidateRate(errors, request.Rate, taxCategoryDefinition);

        if (request.EffectiveFrom == default)
        {
            errors[nameof(ChangeTaxRateRequest.EffectiveFrom)] = ["適用開始日は必須です。"];
        }

        return errors;
    }

    private static void ValidateRate(
        Dictionary<string, string[]> errors,
        decimal rate,
        TaxCategoryDefinition? taxCategoryDefinition)
    {
        if (rate < 0)
        {
            errors[nameof(ChangeTaxRateRequest.Rate)] = ["税率は0以上で指定してください。"];
        }
        else if (rate > 9.9999m)
        {
            errors[nameof(ChangeTaxRateRequest.Rate)] = ["税率は9.9999以下で指定してください。"];
        }
        else if (decimal.Round(rate, 4) != rate)
        {
            errors[nameof(ChangeTaxRateRequest.Rate)] = ["税率は小数4桁までで指定してください。"];
        }
        else if (taxCategoryDefinition is { RequiresZeroRate: true } && rate != 0.0000m)
        {
            errors[nameof(ChangeTaxRateRequest.Rate)] = ["非課税・免税の税率は0.0000で指定してください。"];
        }
        else if (taxCategoryDefinition is { RequiresZeroRate: false } && rate <= 0)
        {
            errors[nameof(ChangeTaxRateRequest.Rate)] = ["課税対象の税率は0より大きい値で指定してください。"];
        }
    }
}
