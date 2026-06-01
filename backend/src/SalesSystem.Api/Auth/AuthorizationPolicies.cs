namespace SalesSystem.Api.Auth;

public static class AuthorizationPolicies
{
    public const string AuthenticatedUser = nameof(AuthenticatedUser);
    public const string MasterMaintainer = nameof(MasterMaintainer);
}
