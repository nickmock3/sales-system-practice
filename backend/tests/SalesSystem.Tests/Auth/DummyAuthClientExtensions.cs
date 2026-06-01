using System.Net.Http.Headers;
using SalesSystem.Api.Auth;

namespace SalesSystem.Tests.Auth;

public static class DummyAuthClientExtensions
{
    public static void SetDummyUser(this HttpClient client, string userName, params string[] roles)
    {
        client.DefaultRequestHeaders.Remove(DummyAuthenticationDefaults.UserHeaderName);
        client.DefaultRequestHeaders.Remove(DummyAuthenticationDefaults.RolesHeaderName);

        client.DefaultRequestHeaders.Add(DummyAuthenticationDefaults.UserHeaderName, userName);

        if (roles.Length > 0)
        {
            client.DefaultRequestHeaders.Add(DummyAuthenticationDefaults.RolesHeaderName, string.Join(",", roles));
        }
    }

    public static void ClearDummyUser(this HttpClient client)
    {
        client.DefaultRequestHeaders.Remove(DummyAuthenticationDefaults.UserHeaderName);
        client.DefaultRequestHeaders.Remove(DummyAuthenticationDefaults.RolesHeaderName);
        client.DefaultRequestHeaders.Authorization = (AuthenticationHeaderValue?)null;
    }
}
