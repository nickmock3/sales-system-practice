using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using SalesSystem.Api.Auth;

namespace SalesSystem.Tests.Auth;

public sealed class AuthorizationTests : IClassFixture<SalesSystemWebApplicationFactory>
{
    private readonly WebApplicationFactory<Program> _factory;

    public AuthorizationTests(SalesSystemWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task AuthenticatedEndpoint_WithoutUserHeader_ReturnsUnauthorized()
    {
        // ユーザー指定がないリクエストは未認証として 401 Unauthorized になる。
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync("/_auth-test/authenticated");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AuthenticatedEndpoint_WithUserHeader_ReturnsOk()
    {
        // ユーザー指定があるリクエストは認証済みとして AuthenticatedUser ポリシーを通過できる。
        using var client = _factory.CreateClient();
        client.SetDummyUser("user1");

        using var response = await client.GetAsync("/_auth-test/authenticated");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task MasterMaintainerEndpoint_WithoutRole_ReturnsForbidden()
    {
        // 認証済みでも必要なロールがない場合は 403 Forbidden になる。
        using var client = _factory.CreateClient();
        client.SetDummyUser("user1");

        using var response = await client.GetAsync("/_auth-test/master-maintainer");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task MasterMaintainerEndpoint_WithMasterMaintainerRole_ReturnsOk()
    {
        // MasterMaintainer ロールがある場合は MasterMaintainer ポリシーを通過できる。
        using var client = _factory.CreateClient();
        client.SetDummyUser("user1", Roles.MasterMaintainer);

        using var response = await client.GetAsync("/_auth-test/master-maintainer");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task MasterMaintainerEndpoint_WithCommaSeparatedRoles_ReturnsOk()
    {
        // カンマ区切りの複数ロールに MasterMaintainer が含まれていれば認可される。
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(DummyAuthenticationDefaults.UserHeaderName, "user1");
        client.DefaultRequestHeaders.Add(DummyAuthenticationDefaults.RolesHeaderName, "SalesOperator, MasterMaintainer");

        using var response = await client.GetAsync("/_auth-test/master-maintainer");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
