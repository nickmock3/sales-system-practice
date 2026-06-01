# PackageReference と DI メモ

## 結論

DI 登録は `.csproj` の `PackageReference` を見て自動で行われるわけではない。

役割は分かれている。

```text
.csproj の PackageReference
  必要なライブラリをプロジェクトに追加する

Program.cs / ServiceCollectionExtensions.cs
  追加したライブラリを使って DI 登録する
```

## `PackageReference` の役割

`PackageReference` は、NuGet パッケージをプロジェクトで使えるようにする設定。

今回の API プロジェクトには以下がある。

```xml
<PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="10.0.8" />
```

これにより、C# コードで EF Core SQLite 用の API を使えるようになる。

例:

```csharp
options.UseSqlite(connectionString);
```

ただし、パッケージを追加しただけでは `AppDbContext` は DI コンテナに登録されない。

## DI 登録の役割

実際に DI に登録しているのは `ServiceCollectionExtensions.cs`。

```csharp
services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlite(connectionString);
});
```

この登録により、アプリ内で `AppDbContext` を DI から受け取れるようになる。

`Program.cs` では、以下のように登録処理を呼び出している。

```csharp
builder.Services.AddSalesSystemPersistence(builder.Configuration);
```

## `/health` での利用

`/health` endpoint では、引数として `AppDbContext` を受け取っている。

```csharp
app.MapGet("/health", async (AppDbContext dbContext, CancellationToken cancellationToken) =>
{
    await dbContext.Database.EnsureCreatedAsync(cancellationToken);
    var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);
    ...
});
```

ASP.NET Core は、この `AppDbContext` を DI コンテナから解決して渡している。

## 流れ

```text
1. .csproj に Microsoft.EntityFrameworkCore.Sqlite を追加する
   ↓
2. C# コードで UseSqlite が使えるようになる
   ↓
3. AddDbContext<AppDbContext>(...) で DI に登録する
   ↓
4. endpoint や service で AppDbContext を受け取れる
```

## たとえ

`.csproj` は材料をプロジェクトに入れる設定。

DI 登録は、その材料を使ってアプリの部品として組み込む処理。

そのため、パッケージ追加と DI 登録は両方必要。
