# 002: フロントエンド基盤を作成する

## 目的

販売管理システムの画面実装を始められるように、Next.js、TypeScript、Bun のフロントエンド基盤を作成する。

## 対象範囲

- Next.js プロジェクトを作成する。
- TypeScript を有効にする。
- Bun で依存関係のインストールと起動ができるようにする。
- API 接続先を環境変数で切り替えられる構成にする。
- 最低限のトップページを作成する。
- フロントエンドの起動手順を README に追記する。

## 技術方針

- フロントエンドは Next.js、TypeScript、Bun を使う。
- API URL など環境依存の値は `.env.local` に置き、Git 管理しない。
- サンプル画面は後続の業務画面実装を邪魔しない最小構成にする。

## 完了条件

- `bun install` が成功する。
- `bun run dev` で Next.js が起動する。
- ブラウザでトップページを表示できる。
- README にフロントエンドの起動方法が記載されている。

## 実装内容

- `frontend/` に Next.js / TypeScript / App Router のプロジェクトを作成した。
- Bun 用の依存関係 lockfile `frontend/bun.lock` を作成した。
- API 接続先を `NEXT_PUBLIC_API_BASE_URL` で切り替える `src/lib/config.ts` を追加した。
- Git 管理するサンプル環境変数として `frontend/.env.example` を追加した。
- トップページを販売管理システム向けの最小画面に差し替え、API 接続先と実装予定領域を表示するようにした。
- `next.config.ts` に `turbopack.root` を明示し、親ディレクトリの lockfile を workspace root と誤認しないようにした。
- README にフロントエンドの環境変数、起動、lint、build 手順を追記した。

## 設計メモ

- API URL はブラウザ側でも参照するため、Next.js の公開環境変数として `NEXT_PUBLIC_API_BASE_URL` を使う。
- `.env.local` はローカル環境ごとの差分を置くため Git 管理しない。共有する初期値は `.env.example` に残す。
- サンプル画面は後続の業務画面実装を邪魔しないよう、ナビゲーションや状態管理を作り込まず静的な最小構成にした。

## 確認結果

- `bun install`: 成功
- `bun run lint`: 成功
- `bun run build`: 成功
- `bun run dev`: `http://localhost:3000` で起動することを確認
- Browser でトップページを開き、ページタイトル、見出し、API Base URL 表示を確認
