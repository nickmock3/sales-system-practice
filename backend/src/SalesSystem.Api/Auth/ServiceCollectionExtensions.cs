using Microsoft.AspNetCore.Authentication;

namespace SalesSystem.Api.Auth;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddSalesSystemAuth(this IServiceCollection services)
    {
        services
            .AddAuthentication(DummyAuthenticationDefaults.AuthenticationScheme)
            .AddScheme<AuthenticationSchemeOptions, DummyAuthenticationHandler>(
                DummyAuthenticationDefaults.AuthenticationScheme,
                options => { });

        services.AddAuthorization(options =>
        {
            options.AddPolicy(
                AuthorizationPolicies.AuthenticatedUser,
                policy => policy.RequireAuthenticatedUser());

            options.AddPolicy(
                AuthorizationPolicies.MasterMaintainer,
                policy => policy.RequireRole(Roles.MasterMaintainer));
        });

        return services;
    }
}
