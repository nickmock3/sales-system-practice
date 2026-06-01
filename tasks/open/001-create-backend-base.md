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

## 確認結果

未実施。
