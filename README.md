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

主な業務仕様:

- `specs/product-master.md`: 商品マスタ
- `specs/customer-master.md`: 得意先マスタ
- `specs/tax-rates.md`: 税率
- `specs/unit-prices.md`: 得意先別単価
- `specs/sales-entry.md`: 売上入力

## Local Development

### 必要なツール

- .NET SDK 10 系
- Bun
- curl など HTTP リクエストを送れるツール
- 任意: VS Code + C# Dev Kit

`.NET` の SDK バージョンは `global.json` で固定します。インストール済み SDK は次のコマンドで確認できます。

```sh
dotnet --list-sdks
bun --version
```

### 初回セットアップ

```sh
cd backend
dotnet restore

cd ../frontend
bun install
cp .env.example .env.local
```

`frontend/.env.local` はローカル環境ごとの設定ファイルです。秘密情報や個人環境に依存する値を置けるように Git 管理しません。

```sh
NEXT_PUBLIC_API_BASE_URL=http://localhost:5134
```

## Backend

バックエンドは .NET 10 / ASP.NET Core Web API で、ローカル開発用 DB は SQLite ファイル DB を使います。

### DB

ローカル開発では `backend/src/SalesSystem.Api/sales-system-dev.db` を SQLite ファイル DB として使います。接続文字列は `backend/src/SalesSystem.Api/appsettings.json` の `ConnectionStrings:DefaultConnection` で管理します。

現在の初期化は `GET /health` 実行時の `EnsureCreatedAsync` による最小構成です。正式なスキーマ管理は、後続タスクで Entity Framework Core migrations を導入してから扱います。

DB を作り直したい場合は、API を停止してから SQLite ファイルを削除し、再度 API を起動して `GET /health` を実行します。

```sh
rm backend/src/SalesSystem.Api/sales-system-dev.db
```

本番想定 DB は Oracle Database です。SQLite は軽量なローカル開発用であり、SQLite での成功は Oracle 互換を保証しません。特にマイグレーション、制約、インデックス、日付比較、金額精度、ページング、履歴取得クエリは Oracle 上でも確認します。

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

## Frontend

フロントエンドは Next.js / TypeScript / Bun で構成します。

### 環境変数

```sh
cd frontend
cp .env.example .env.local
```

`.env.local` で API 接続先を切り替えます。このファイルは Git 管理しません。

```sh
NEXT_PUBLIC_API_BASE_URL=http://localhost:5134
```

### 起動

```sh
cd frontend
bun install
bun run dev
```

デフォルトでは `http://localhost:3000` でトップページを表示できます。

### ビルドと lint

```sh
cd frontend
bun run lint
bun run build
```
