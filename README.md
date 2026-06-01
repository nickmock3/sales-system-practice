# Sales System Practice

販売管理システムの実装練習用リポジトリです。

## Documentation

- `specs/`: 仕様
- `tasks/open/`: 未完了タスク
- `tasks/done/`: 完了タスク
- `docs/learning/`: 学習メモ、概念整理、つまずきの記録

タスクファイル名は `001-create-product-master-api.md` のように、先頭に3桁の連番を付けます。

システム仕様や業務ルールは `specs/` に残し、実装作業の記録は `tasks/` に残します。`.NET` や VS Code などの学習メモは `docs/learning/` に分けます。

主な学習メモ:

- `docs/learning/dotnet-project-structure.md`: `.slnx`、`.csproj`、`global.json`
- `docs/learning/http-request-files.md`: `.http` ファイル
- `docs/learning/vscode-csharp-devkit.md`: VS Code と C# Dev Kit
- `docs/learning/dependency-injection-and-packages.md`: `PackageReference` と DI

## Backend

バックエンドは .NET 10 / ASP.NET Core Web API で、ローカル開発用 DB は SQLite ファイル DB を使います。

### 起動

```sh
cd backend/src/SalesSystem.Api
dotnet run
```

疎通確認:

```sh
curl http://localhost:5134/health
```

手動確認用の `.http` ファイルは `backend/requests/` に置きます。実行コードではないため API プロジェクト直下には置かず、機能別に `health.http`、`products.http` のように分けます。

### ビルドとテスト

```sh
cd backend
dotnet build
dotnet test
```

テストでは SQLite in-memory を使用します。SQLite での成功は Oracle 互換を保証するものではないため、Oracle 固有の確認は後続タスクで行います。
