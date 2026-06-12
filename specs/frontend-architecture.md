# フロントエンド構成方針

## 目的

Next.js App Router の標準構成に寄せながら、販売管理システムの業務画面を実装しやすいフロントエンド基盤を定める。

## 技術構成

- Next.js
- TypeScript
- Bun
- Tailwind CSS v4
- Zod
- React Hook Form
- Vitest
- Playwright

## ディレクトリ構成

フロントエンドは Next.js App Router のルートセグメントを中心に構成する。
バックエンドは機能別の vertical slice とするが、フロントエンドでは `features/` を最上位に置かず、画面固有のコードを `app/<route>/` 配下へ寄せる。

想定構成:

```text
frontend/
  e2e/
    fixtures/
  src/
    app/
      layout.tsx
      page.tsx
      globals.css
      ui-catalog/
        page.tsx
      products/
        page.tsx
        _api.ts
        _components/
        _schemas.ts
        _types.ts
      customers/
        page.tsx
        _api.ts
        _components/
        _schemas.ts
        _types.ts
      tax-rates/
        page.tsx
        _api.ts
        _components/
        _schemas.ts
        _types.ts
      customer-product-prices/
        page.tsx
        _api.ts
        _components/
        _schemas.ts
        _types.ts
      sales/
        page.tsx
        _api.ts
        _components/
        _schemas.ts
        _types.ts
    components/
      ui/
    lib/
      api/
      config/
      format/
      utils/
    test/
```

配置ルール:

- 画面固有の API 呼び出し、型、Zod スキーマ、コンポーネントは `app/<route>/` 配下に置く。
- ルートセグメント内の補助ファイルは、URL にならないことが分かるように `_api.ts`、`_components/` のような private folder / private file 相当の命名にする。
- トップページ `/` は業務画面への入口と接続状態の確認に絞り、UI 部品や表示パターンの見本は `/ui-catalog` に分離する。
- 得意先別商品単価画面は `app/customer-product-prices/` に置き、得意先マスタと商品マスタから得意先 ID または商品 ID で絞り込める導線を作る。
- 複数画面で使う UI プリミティブは `src/components/ui/` に置く。
- 複数画面で使う API 共通処理、環境変数、日付・金額表示、汎用ヘルパーは `src/lib/` に置く。
- テスト共通処理は `src/test/` または `e2e/fixtures/` に置く。

## API クライアント

API 契約は `specs/api-contracts.md` に従う。画面固有の型と Zod スキーマは、内部履歴 ID を含まない DTO を前提に定義する。

- 共通の `apiFetch` を `src/lib/api/` 配下に作る。
- API ベース URL は `NEXT_PUBLIC_API_BASE_URL` で指定する。
- ダミー認証ヘッダーは `apiFetch` で一元的に付与する。
- HTTP エラーは共通の `ApiError` に変換する。
- API バリデーションエラーは、フォームや画面上部に表示しやすい形式へ変換する。
- 画面固有の API 関数は `app/<route>/_api.ts` に置く。
- API レスポンスは、重要な境界から Zod で検証する。

## 環境変数

- `.env.example` にフロントエンドで必要な環境変数を記載する。
- `NEXT_PUBLIC_API_BASE_URL` は必須とする。
- 環境変数は `src/lib/config/` 配下で Zod を使って検証する。
- 未設定や不正な値は、開発時に原因が分かるエラーとして扱う。

## ダミー認証 UI

バックエンドは開発・学習用のダミー認証を使うため、フロントエンドにもユーザー状態を切り替える UI を用意する。

要件:

- 画面上部から現在のダミーユーザー状態を確認できる。
- ボタンまたはポップアップメニューで以下を切り替えられる。
  - 一般ユーザー
  - 管理者
  - ログアウト
- 一般ユーザーは参照系 API を操作できる。
- 管理者は参照系 API と更新系 API を操作できる。
- ログアウト状態では認証が必要な API で権限エラーを確認できる。
- 選択中のユーザー状態は、ページ遷移後も維持する。

ヘッダー付与方針:

```text
一般ユーザー:
  X-Dummy-User: user1

管理者:
  X-Dummy-User: admin1
  X-Dummy-Roles: MasterMaintainer

ログアウト:
  X-Dummy-User と X-Dummy-Roles を付与しない
```

保存先は、学習用としてまず `localStorage` を使う。
本物の認証 Cookie、トークン、パスワード入力、ユーザー登録は作らない。

## フォーム

- フォームは React Hook Form と Zod を使う。
- 入力エラーは各フィールド直下に日本語で表示する。
- 送信中は二重送信を防ぐ。
- 成功後は対象データを再取得し、必要に応じてフォームをリセットする。
- API エラーは画面上部またはフォーム上部に表示する。

## 表示形式

- 日付入力は `yyyy-MM-dd` とする。
- 日付表示は `yyyy/MM/dd` とする。
- 金額は `Intl.NumberFormat("ja-JP")` を使って表示する。
- 税率は `10%` のような百分率で表示する。
- 画面には業務上意味のあるコード（商品コード、得意先コードなど）を表示する。
- `ProductVersionId`、`CustomerVersionId`、`TaxRateId`、`CustomerProductPriceId`、`SaleStatusHistoryId` や `Version` といった内部履歴 ID は、通常画面と画面用 TypeScript 型へ露出しない。
- 集約 ID（`productId`、`customerId`、`saleId` など）は画面実装の都合で保持してよいが、利用者向けの主要表示項目にはしない。

## エラー表示

- 入力エラーは、該当フィールドの近くに表示する。
- API バリデーションエラーは、フォーム上部と可能な範囲で該当フィールドに表示する。
- 認証エラーは、ログアウト状態であることが分かる表示にする。
- 認可エラーは、現在のユーザーでは権限不足であることが分かる表示にする。
- 通信エラーは、バックエンド API が起動していない可能性も分かる表示にする。
- 予期しないエラーは、画面全体を壊さず汎用エラーとして表示する。

## デザイン方針

- 業務システムとして、静かで情報を探しやすい UI を優先する。
- 派手な hero、装飾的な背景、過剰なアニメーションは使わない。
- マスタ画面は、一覧、選択中の詳細、変更履歴、登録・情報変更フォームを確認しやすい構成にする。
- 画面全体は淡いグレー背景、白い作業領域、控えめな境界線を基本にし、注意・成功・エラーだけに意味のある色を使う。
- 操作ボタンは主要操作、補助操作、破壊的操作の優先度が分かる見た目にし、アイコンは `lucide-react` を使う。
- テーブルは検索条件、一覧、選択中の詳細、変更履歴の関係が分かる密度を優先し、カードを重ねた装飾的な構成にしない。
- フォームはラベル、入力、補足、エラーを近接させ、入力エラーでは原因と修正方法が分かる日本語文を表示する。
- `/ui-catalog` は共通 UI の確認用ページとし、トップページや業務画面そのものをデザイン見本にしない。
- Product Design プラグインを使う場合も、まずこの方針をブリーフとして確認する。
- 個別画面の詳細デザインは、各画面タスクで決める。

## テスト方針

フロントエンドのテスト方針は `specs/frontend-testing.md` に従う。

画面タスクでは、少なくとも以下を確認する。

- lint
- Vitest
- Playwright の対象画面 E2E

Playwright は基本的に API モックで画面の安定確認を行い、実バックエンド API を使う結合 E2E は主要な正常系に絞る。
