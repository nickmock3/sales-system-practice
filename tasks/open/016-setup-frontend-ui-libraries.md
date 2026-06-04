# 016 フロントエンドの UI・フォーム基盤ライブラリを導入する

## 目的

マスタ画面や売上画面を実装する前に、スタイル、フォーム、入力検証、アイコン、className 合成の基本方針を決め、フロントエンド実装の土台を整える。

## 対象範囲

- Tailwind CSS v4 を Next.js フロントエンドに導入する。
- `zod` を導入し、入力値や API レスポンス検証に使える状態にする。
- `react-hook-form` と `@hookform/resolvers` を導入し、Zod と連携できる状態にする。
- `lucide-react` を導入し、画面操作用アイコンに使える状態にする。
- `clsx` と `tailwind-merge` を導入し、`cn()` のような className 合成ヘルパーを用意する。
- Vitest を導入し、フロントエンドの単体テスト・軽量なコンポーネントテストを実行できる状態にする。
- Playwright を導入し、主要画面の E2E テストを実行できる状態にする。
- 共通 UI コンポーネントを置くディレクトリ方針を決める。
- Product Design プラグインを使う前提で、業務画面の共通デザイン方針を決める。
- App Router に寄せたディレクトリ構成、API クライアント、環境変数、ダミー認証 UI、デザイン方針を `specs/frontend-architecture.md` に記録する。
- 得意先別商品単価画面用の `app/customer-product-prices/` 配置方針を `specs/frontend-architecture.md` に記録する。
- 既存のトップページやグローバル CSS を Tailwind 前提に最小限整理する。

## 前提仕様

- フロントエンドは Next.js、TypeScript、Bun を使う。
- 業務画面は学習用として、装飾よりも操作内容とデータ状態の分かりやすさを優先する。
- フォーム入力エラーは、何が誤りでどう直すべきか分かる表示にする。
- API エラーで画面全体がクラッシュしないようにする。
- フロントエンドの構成方針は `specs/frontend-architecture.md` に従う。
- フロントエンドのテスト方針は `specs/frontend-testing.md` に従う。
- デザイン検討では Product Design プラグインを活用し、画面実装前にブリーフを確認する。

## 導入候補ライブラリ

- `tailwindcss`
- `@tailwindcss/postcss`
- `zod`
- `react-hook-form`
- `@hookform/resolvers`
- `lucide-react`
- `clsx`
- `tailwind-merge`
- `vitest`
- `jsdom`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`
- `@playwright/test`

## 実装方針

- Tailwind CSS は v4 系の構成に合わせて導入する。
- 共通 UI は、まず小さな自前コンポーネントから始める。
- `shadcn/ui` はこのタスクでは導入せず、画面数が増えて必要になった時点で再検討する。
- API 型、フォームスキーマ、UI コンポーネントの責務を混ぜすぎない。
- `any` を前提にした実装を避け、Zod スキーマまたは TypeScript 型で境界を明確にする。
- `016` ではアプリ全体のデザイン原則、レイアウト、色、フォーム、エラー表示、テーブル表示の共通方針までを決める。
- フロントエンドのディレクトリ構成は `features/` 最上位ではなく、Next.js App Router の `app/<route>/` を中心にする。
- ダミー認証は、画面上部のボタンまたはポップアップで一般ユーザー、管理者、ログアウトを切り替えられるようにする。
- 個別画面の詳細デザインは、各画面タスクで Product Design プラグインを使って確認する。
- API クライアントは、通常の一覧・登録 API だけでなく、商品、得意先、税率、得意先別商品単価、売上明細の `preview` 系 API も扱えるエラー変換方針にする。
- 得意先別商品単価画面は `app/customer-product-prices/` とし、得意先マスタ画面や商品マスタ画面から絞り込み導線を作れる構成にする。
- Vitest はロジック、Zod スキーマ、UI コンポーネントの状態確認に使う。
- Playwright は画面遷移、フォーム入力、API 連携を含むユーザー操作の確認に使う。
- E2E テストでは、バックエンド API を使うテストと、必要に応じてモックするテストの境界を明確にする。
- テストコマンド、テスト配置、モック方針は `specs/frontend-testing.md` と整合させる。

## 確認項目

- `bun install` が成功すること。
- `bun lint` が成功すること。
- `bun test` または Vitest 用に定義したテストコマンドが成功すること。
- Playwright 用に定義したテストコマンドが成功すること。
- `bun run build` が成功すること。
- Tailwind のユーティリティクラスが画面に反映されること。
- `cn()` ヘルパーが利用できること。
- フロントエンド構成方針と業務画面の共通デザイン方針が仕様として記録されていること。

## 完了時に追記すること

- 導入したライブラリと用途
- 追加・変更した設定ファイル
- 追加した共通ヘルパーやディレクトリ
- 記録したフロントエンド構成方針とデザイン方針
- 実行した確認コマンドと結果
- 残した制約や次タスク候補
