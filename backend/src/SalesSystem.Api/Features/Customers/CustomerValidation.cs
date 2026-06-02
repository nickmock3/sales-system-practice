namespace SalesSystem.Api.Features.Customers;

internal static class CustomerValidation
{
    public static Dictionary<string, string[]> ValidateCreateCustomer(CreateCustomerRequest request)
    {
        var errors = ValidateVersionFields(
            request.Name,
            request.Address,
            request.PhoneNumber,
            request.ValidFrom);

        AddRequiredString(errors, nameof(request.CustomerCode), request.CustomerCode, 30);

        return errors;
    }

    public static Dictionary<string, string[]> ValidateCreateCustomerVersion(CreateCustomerVersionRequest request)
    {
        return ValidateVersionFields(
            request.Name,
            request.Address,
            request.PhoneNumber,
            request.ValidFrom);
    }

    private static Dictionary<string, string[]> ValidateVersionFields(
        string? name,
        string? address,
        string? phoneNumber,
        DateTime validFrom)
    {
        var errors = new Dictionary<string, string[]>();

        AddRequiredString(errors, nameof(CreateCustomerRequest.Name), name, 100);
        AddRequiredString(errors, nameof(CreateCustomerRequest.Address), address, 300);
        AddRequiredString(errors, nameof(CreateCustomerRequest.PhoneNumber), phoneNumber, 30);

        if (validFrom == default)
        {
            errors[nameof(CreateCustomerRequest.ValidFrom)] = ["適用開始日は必須です。"];
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
