using SalesSystem.Api.Features.Taxes;

namespace SalesSystem.Api.Features.Products;

internal static class ProductValidation
{
    public static Dictionary<string, string[]> ValidateCreateProduct(CreateProductRequest request)
    {
        var errors = ValidateChangeFields(
            request.Name,
            request.Unit,
            request.StandardUnitPrice,
            request.TaxCategory,
            request.EffectiveFrom);

        AddRequiredString(errors, nameof(request.ProductCode), request.ProductCode, 30);

        return errors;
    }

    public static Dictionary<string, string[]> ValidateChangeProduct(ChangeProductRequest request)
    {
        return ValidateChangeFields(
            request.Name,
            request.Unit,
            request.StandardUnitPrice,
            request.TaxCategory,
            request.EffectiveFrom);
    }

    private static Dictionary<string, string[]> ValidateChangeFields(
        string? name,
        string? unit,
        decimal standardUnitPrice,
        string? taxCategory,
        DateTime effectiveFrom)
    {
        var errors = new Dictionary<string, string[]>();

        AddRequiredString(errors, nameof(CreateProductRequest.Name), name, 100);
        AddRequiredString(errors, nameof(CreateProductRequest.Unit), unit, 20);
        AddRequiredString(errors, nameof(CreateProductRequest.TaxCategory), taxCategory, 30);

        if (!string.IsNullOrWhiteSpace(taxCategory)
            && taxCategory.Length <= 30
            && !TaxCategories.TryGet(taxCategory.Trim(), out _))
        {
            errors[nameof(CreateProductRequest.TaxCategory)] = ["未知の税区分です。"];
        }

        if (standardUnitPrice < 0)
        {
            errors[nameof(CreateProductRequest.StandardUnitPrice)] = ["標準単価は0以上で指定してください。"];
        }
        else if (decimal.Round(standardUnitPrice, 2) != standardUnitPrice)
        {
            errors[nameof(CreateProductRequest.StandardUnitPrice)] = ["標準単価は小数2桁までで指定してください。"];
        }

        if (effectiveFrom == default)
        {
            errors[nameof(CreateProductRequest.EffectiveFrom)] = ["適用開始日は必須です。"];
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
