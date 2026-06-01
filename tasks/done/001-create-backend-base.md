# 001: バックエンド基盤を作成する

## 目的

販売管理システムの API 実装を始められるように、ASP.NET Core Web API、xUnit、EF Core、ローカル開発用 SQLite の基盤を作成する。

## 対象範囲

- ASP.NET Core Web API プロジェクトを作成する。
- xUnit テストプロジェクトを作成する。
- API プロジェクトとテストプロジェクトを solution に含める。
- EF Core を導入する。
- ローカル開発用 DB として SQLite ファイル DB を使える構成にする。
- テスト用 DB として SQLite in-memory を使える構成にする。
- 疎通確認用の health endpoint を追加する。
- バックエンドの起動手順とテスト手順を README に追記する。

## 技術方針

- バックエンドは C# / .NET / ASP.NET Core Web API を使う。
- ORM は Entity Framework Core を使う。
- 本番想定 DB は Oracle Database とする。
- このタスクでは Oracle 実接続までは行わないが、将来 Oracle provider に切り替えやすい DbContext 構成にする。
- SQLite の成功だけで Oracle 互換を保証したものとは扱わない。

## 完了条件

- `dotnet build` が成功する。
- `dotnet test` が成功する。
- API を起動すると health endpoint が 200 を返す。
- README にバックエンドの起動方法とテスト方法が記載されている。

## 実装内容

- `backend/SalesSystem.sln` を作成した。
- `backend/src/SalesSystem.Api` に .NET 10 の ASP.NET Core Web API プロジェクトを作成した。
- `backend/tests/SalesSystem.Tests` に xUnit テストプロジェクトを作成した。
- API プロジェクトに EF Core SQLite / Design を追加した。
- テストプロジェクトに `Microsoft.AspNetCore.Mvc.Testing` と EF Core SQLite を追加した。
- `AppDbContext` と SQLite 用の DI 登録を追加した。
- ローカル開発用接続文字列 `Data Source=sales-system-dev.db` を `appsettings.json` に追加した。
- 疎通確認用の `GET /health` endpoint を追加した。
- 手動確認用リクエストとして `backend/requests/health.http` を追加した。
- テストでは SQLite in-memory 接続を開いたまま使う構成にした。
- README にバックエンドの起動手順、health 確認手順、ビルド・テスト手順を追記した。

## 設計メモ

- このタスクでは Oracle 実接続は行わず、DbContext 登録を `AddSalesSystemPersistence` に閉じ込めた。後続で Oracle provider を追加する場合は、この登録箇所で provider 切り替えを扱う。
- SQLite in-memory は接続を閉じると DB が消えるため、テスト用 `WebApplicationFactory` では `SqliteConnection` を factory の寿命中開いたまま保持する。
- `GET /health` は初回ローカル起動でも SQLite ファイル DB を使えるように `EnsureCreatedAsync` を実行してから接続確認する。正式なスキーマ管理は後続のマイグレーション導入時に見直す。
- `.http` ファイルは実行コードではなく手動確認用の開発補助ファイルなので、API プロジェクト直下ではなく `backend/requests/` に機能別で配置する。

## 確認結果

- `dotnet build`: 成功
- `dotnet test`: 成功、2 tests passed
- `dotnet run --urls http://localhost:5134` で API を起動し、`curl -i http://localhost:5134/health` が `HTTP/1.1 200 OK` を返すことを確認した。
