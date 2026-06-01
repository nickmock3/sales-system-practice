# .NET プロジェクト構成メモ

## `.slnx`

`.slnx` は複数の C# プロジェクトをまとめる solution ファイル。

このリポジトリでは `backend/SalesSystem.slnx` が以下のプロジェクトをまとめている。

- `backend/src/SalesSystem.Api/SalesSystem.Api.csproj`
- `backend/tests/SalesSystem.Tests/SalesSystem.Tests.csproj`

solution に含まれているため、`backend/` で以下を実行すると API とテストをまとめて扱える。

```sh
dotnet build
dotnet test
```

## `.csproj`

`.csproj` は 1 つの C# プロジェクトの構成ファイル。

主に以下を管理する。

- 対象の .NET バージョン
- nullable 参照型などのコンパイル設定
- NuGet パッケージ参照
- 他プロジェクトへの参照
- Web API やテストなどのプロジェクト種別

例:

```xml
<TargetFramework>net10.0</TargetFramework>
<Nullable>enable</Nullable>
<PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="10.0.8" />
```

## 関係

```text
backend/
  SalesSystem.slnx
    src/SalesSystem.Api/SalesSystem.Api.csproj
    tests/SalesSystem.Tests/SalesSystem.Tests.csproj
```

ざっくり言うと、`.slnx` は複数プロジェクトをまとめる箱で、`.csproj` は個々のプロジェクトの設定。

## `global.json`

`global.json` は、このリポジトリで使用する .NET SDK バージョンを明示するファイル。

このリポジトリでは `.NET 10 LTS` の SDK を使う。

```json
{
  "sdk": {
    "version": "10.0.300",
    "rollForward": "latestFeature"
  }
}
```

`dotnet --info` で、どの `global.json` が使われているか確認できる。

```sh
dotnet --info
```
