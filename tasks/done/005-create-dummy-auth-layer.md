# 005 ダミー認証認可層を追加する

## 目的

実務では API に認証認可が必要になるため、練習用として本物のログイン機能ではなく、ASP.NET Core の認証認可を差し込むための最小構成を追加する。

後続のマスタ API では、この認証認可層を使って参照系と更新系の権限差を表現できるようにする。

## 背景

現在の API は `/health` のみで、認証認可の構成はまだない。

商品マスタ API を作る前に、`RequireAuthorization()` やポリシーを使える状態にしておくことで、後から本物の JWT、Cookie、外部 ID 基盤へ差し替える構造を学習できる。

## 対象仕様

- `specs/overview.md`

## 実装内容

- ASP.NET Core の Authentication / Authorization を設定する。
- 開発・学習用のダミー認証ハンドラーを追加する。
- ダミー認証では、HTTP ヘッダーからユーザー名とロールを読み取る。
  - `X-Dummy-User`
  - `X-Dummy-Roles`
- `X-Dummy-User` がない場合は未認証として扱う。
- `X-Dummy-Roles` はカンマ区切りで複数ロールを指定できるようにする。
- 認可ポリシーを追加する。
  - `AuthenticatedUser`: 認証済みユーザーを要求する。
  - `MasterMaintainer`: `MasterMaintainer` ロールを要求する。
- `/health` は認証不要のままとする。
- 今後追加する業務 API では、参照系は認証済み、更新系は `MasterMaintainer` を要求する方針にする。
- テスト用に認証ヘッダーを付与しやすい helper を用意する。
- 認証認可の正常系、異常系テストを追加する。
- 必要に応じて `.http` ファイルに手動確認用の認証ヘッダー例を追加する。

## 想定仕様

認証済みユーザーの例:

```http
X-Dummy-User: user1
```

マスタ更新権限を持つユーザーの例:

```http
X-Dummy-User: user1
X-Dummy-Roles: MasterMaintainer
```

複数ロールを持つユーザーの例:

```http
X-Dummy-User: user1
X-Dummy-Roles: MasterMaintainer,SalesOperator
```

## 注意点

- 本物のログイン、パスワード管理、ユーザー登録、トークン発行は作らない。
- ダミー認証は開発・学習用であり、本番利用できる認証方式として扱わない。
- 認証方式はダミーでも、ASP.NET Core 標準の Authentication / Authorization の流れに乗せる。
- API 実装側がダミー認証のヘッダー名に直接依存しないようにする。
- ロール名は文字列定数などにまとめ、API 側で手書き文字列が散らばらないようにする。
- `401 Unauthorized` と `403 Forbidden` の違いがテストで分かるようにする。

## 確認内容

- `dotnet test backend/SalesSystem.slnx` が成功する。
- `/health` は認証ヘッダーなしでアクセスできる。
- 認証が必要なテスト用エンドポイント、または後続 API で、`X-Dummy-User` なしの場合は `401 Unauthorized` になる。
- `MasterMaintainer` が必要なテスト用エンドポイント、または後続 API で、ロール不足の場合は `403 Forbidden` になる。
- `X-Dummy-User` と `X-Dummy-Roles: MasterMaintainer` がある場合は、`MasterMaintainer` ポリシーを通過できる。

## 完了時の記録

タスク完了時には、以下をこのファイルに追記してから `tasks/done/` に移動する。

- 追加した認証認可の構成
- ダミー認証ヘッダーの仕様
- 追加したポリシー
- 実行した確認コマンド
- 本番認証へ差し替える場合の後続課題

## 完了記録

### 追加した認証認可の構成

- `SalesSystem.Api.Auth` 名前空間にダミー認証関連の構成を追加した。
- `DummyAuthenticationHandler` で ASP.NET Core 標準の AuthenticationHandler を使い、HTTP ヘッダーから ClaimsPrincipal を作成するようにした。
- `AddSalesSystemAuth()` 拡張メソッドで Authentication / Authorization をまとめて登録するようにした。
- `Program.cs` で `AddSalesSystemAuth()`、`UseAuthentication()`、`UseAuthorization()` を有効化した。
- 開発・テスト用に `/_auth-test/authenticated` と `/_auth-test/master-maintainer` を追加し、ポリシー通過を確認できるようにした。
- テスト用に `HttpClient` へ認証ヘッダーを付与する `SetDummyUser()` helper を追加した。

### ダミー認証ヘッダーの仕様

- `X-Dummy-User` が空または未指定の場合は未認証として扱う。
- `X-Dummy-User` が指定された場合は、その値をユーザー名として認証済みユーザーを作成する。
- `X-Dummy-Roles` はカンマ区切りで複数ロールを指定できる。
- `X-Dummy-Roles` が未指定の場合は、ロールなしの認証済みユーザーとして扱う。

### 追加したポリシー

- `AuthenticatedUser`: 認証済みユーザーを要求する。
- `MasterMaintainer`: `MasterMaintainer` ロールを要求する。

### 実行した確認コマンド

```bash
dotnet test backend/SalesSystem.slnx
```

結果:

- 成功
- 合格: 14
- 失敗: 0
- スキップ: 0

確認した内容:

- `/health` は認証ヘッダーなしで `200 OK` になる。
- 認証が必要なエンドポイントで `X-Dummy-User` なしの場合は `401 Unauthorized` になる。
- `MasterMaintainer` が必要なエンドポイントでロール不足の場合は `403 Forbidden` になる。
- `X-Dummy-User` と `X-Dummy-Roles: MasterMaintainer` がある場合は `MasterMaintainer` ポリシーを通過できる。
- `X-Dummy-Roles: SalesOperator, MasterMaintainer` のような複数ロール指定でも `MasterMaintainer` ポリシーを通過できる。

### 本番認証へ差し替える場合の後続課題

- ダミー認証ハンドラーを JWT、Cookie、Microsoft Entra ID などの本番用認証方式へ差し替える。
- 業務 API 側はヘッダー名ではなく認可ポリシーへ依存する構成を維持する。
- ロール名やポリシー名を外部 ID 基盤のクレーム設計と対応付ける。
- 本番環境では `/_auth-test/*` のような開発・テスト用エンドポイントを公開しない運用にする。
