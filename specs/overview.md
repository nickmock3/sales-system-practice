# 販売管理システム 全体仕様

## 目的

C# / .NET とフロントエンド技術の練習として、販売管理システムのうち「売上」に関係する最小構成のアプリケーションを作成する。

商品分野は法人向け事務用品販売とする。

扱う商品例:

- コピー用紙 A4
- ボールペン 黒
- クリアファイル
- トナー
- ノートPCスタンド

## 初期スコープ

作成する画面:

- 商品マスタ
- 得意先マスタ
- 売上入力画面

売上一覧・売上詳細は、売上入力画面の一部として扱う。

## 実装優先順位

1. 商品マスタの一覧、登録、履歴追加
2. 得意先マスタの一覧、登録、履歴追加
3. 売上入力
4. 売上一覧、詳細
5. 指定日プレビューや履歴確認

今回の学習では、売上日を基準にマスタ履歴と税率を自動適用する UI を重視する。

## データ設計方針

マスタはイミュータブルモデルを意識し、「同一性を表すテーブル」と「変更される属性の履歴テーブル」を分ける。

商品名、単位、標準単価、販売停止フラグ、得意先名、住所、電話番号など、後から変更される可能性がある項目は履歴テーブルに持たせる。

履歴テーブルは `ValidFrom` のみを持ち、`ValidTo` は持たない。

適用する履歴は、対象日以前で一番新しい履歴とする。

```sql
select *
from ProductVersions
where ProductId = @productId
  and ValidFrom <= @salesDate
order by ValidFrom desc
limit 1;
```

## 物理DB命名方針

本番想定 DB である Oracle Database を意識し、物理DB上のテーブル名、カラム名、インデックス名、制約名は `UPPER_SNAKE_CASE` とする。

仕様書や C# コード上では読みやすさのため `ProductVersions`、`ProductId`、`ValidFrom` のような PascalCase 名を使ってよいが、EF Core のマッピングでは以下のように物理名へ変換する。

```text
ProductVersions -> PRODUCT_VERSIONS
ProductId       -> PRODUCT_ID
ValidFrom       -> VALID_FROM
```

Oracle では引用符なしの識別子が大文字扱いになるため、原則として大文字の `UPPER_SNAKE_CASE` 名を明示し、引用符が必要な大小文字混在名には依存しない。

## DB実装方針

- ID は C# の `long` とする。
- 日付・日時は C# の `DateTime` とする。
- `SalesDate` と `ValidFrom` は `DateTime` で保持するが、業務上は日付部分のみを有効とする。
- 税区分は `string` で保持し、アプリケーション側の定数で管理する。
- マスタ、履歴、売上は物理削除しない。
- 外部キーの削除動作は `Restrict` を基本とする。
- `CreatedAt` はアプリケーション側で UTC 現在日時を設定する。

## 履歴設計ルール

- 履歴レコードは原則更新しない。
- マスタの変更は履歴レコードの追加で表現する。
- 同じマスタ ID で同じ `ValidFrom` の履歴を重複させない。
- 初回の `ValidFrom` より前の売上日は、適用できる履歴が存在しないものとして扱う。
- 販売停止や得意先情報の変更も履歴レコードの追加で表現する。
- 税率変更も `TaxRates` の追加で表現する。

## 技術構成

### バックエンド

- C#
- .NET
- ASP.NET Core Web API
- Entity Framework Core
- SQLite ファイルDB
- xUnit

通常実行時は SQLite ファイルDBを使用し、テストでは SQLite in-memory を使用する。

EF Core の `UseInMemoryDatabase` はリレーショナルDBではないため、今回は SQLite in-memory を使って外部キー制約や SQL 実行に近い挙動を確認する。

SQLite in-memory は接続を閉じるとデータベースが消えるため、テスト中は同じ DB 接続を開いたままにする。

## 認証認可方針

実務では API に認証認可が必要になるため、このリポジトリでも ASP.NET Core の Authentication / Authorization を使う。

ただし、学習用の初期スコープでは本物のログイン、パスワード管理、ユーザー登録、トークン発行、外部 ID 基盤連携は作らない。

認証方式は開発・学習用のダミー認証とし、HTTP ヘッダーからユーザー名とロールを読み取る。

```http
X-Dummy-User: user1
X-Dummy-Roles: MasterMaintainer
```

- `X-Dummy-User` がある場合は認証済みユーザーとして扱う。
- `X-Dummy-User` がない場合は未認証として扱う。
- `X-Dummy-Roles` はカンマ区切りで複数ロールを指定できる。
- `X-Dummy-Roles` がない場合はロールなしの認証済みユーザーとして扱う。

認可ポリシーは以下を用意する。

- `AuthenticatedUser`: 認証済みユーザーを要求する。
- `MasterMaintainer`: `MasterMaintainer` ロールを要求する。

業務 API の認可方針は以下とする。

- 参照系 API は `AuthenticatedUser` を要求する。
- 登録、変更、履歴追加などの更新系 API は `MasterMaintainer` を要求する。
- `/health` は認証不要とする。

ダミー認証は本番利用できる認証方式として扱わない。

後から JWT、Cookie、Microsoft Entra ID などへ差し替える場合でも、業務 API 側は ASP.NET Core 標準の認可ポリシーに依存し、ダミー認証のヘッダー名へ直接依存しないようにする。

### フロントエンド

- Next.js
- TypeScript
- Bun

## バックエンド構成方針

バックエンドは機能別ディレクトリを最上位に置く。

その中で、必要に応じて `Api`、`Application`、`Domain`、`Infrastructure` に分ける。

すべての機能に同じ厚さで Clean Architecture や DDD を適用するのではなく、業務ルールが複雑な機能だけ設計を厚くする。

想定構成:

```text
backend/
  src/
    SalesSystem.Api/
      Features/
        Products/
          Api/
          Application/
          Domain/
          Infrastructure/
        Customers/
          Api/
          Application/
          Domain/
          Infrastructure/
        Sales/
          Api/
          Application/
          Domain/
          Infrastructure/
        Taxes/
          Application/
          Infrastructure/
      Persistence/
      Program.cs
  tests/
    SalesSystem.Tests/
      Features/
        Products/
        Customers/
        Sales/
        Taxes/
```

機能ごとの設計の厚さ:

- `Products`: 履歴管理、商品コード、税区分などのルールがあるため、軽めの DDD / CQRS を使う。
- `Customers`: 履歴管理はあるがルールは比較的少ないため、Application 中心で必要に応じて Domain を使う。
- `Sales`: 売上日から商品履歴、得意先履歴、税率を決め、金額と税額を計算するため、DDD 寄りにする。
- `Taxes`: 売上日以前の税率を取得するだけに近いため、最初はシンプルに実装する。

## 初期スコープ外

### 割引

割引は初期スコープには含めず、拡張課題として扱う。

将来的に追加する場合は、得意先別割引、商品別割引、キャンペーン割引などを別テーブルで管理する。

### 外部システム連携

外部システム連携は初期スコープには含めず、将来拡張として扱う。

実装する場合は Outbox Pattern を使い、売上登録などの業務データ更新と同じトランザクションでイベントを `OutboxMessages` に保存する。
