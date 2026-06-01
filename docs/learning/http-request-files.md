# `.http` ファイルメモ

## 役割

`.http` ファイルは、API に手動でリクエストを送るための開発補助ファイル。

アプリ本体の実行には必須ではない。削除しても通常は API のビルドや実行には影響しない。

## 配置

このリポジトリでは、手動確認用の `.http` ファイルは `backend/requests/` に置く。

理由:

- `.http` は実行コードではない
- API プロジェクト直下に置くと、コードと確認用ファイルが混ざる
- API が増えた時に、機能別に分けた方が見通しがよい

例:

```text
backend/
  requests/
    health.http
    products.http
    customers.http
    sales.http
```

## 現在の health 確認

```http
@SalesSystem.Api_HostAddress = http://localhost:5134

GET {{SalesSystem.Api_HostAddress}}/health
Accept: application/json
```

これは以下の `curl` と同じ意味。

```sh
curl http://localhost:5134/health
```

## 今後の使い方

API が増えたら、機能別にファイルを追加する。

例:

```http
### 商品一覧

GET {{SalesSystem.Api_HostAddress}}/products
Accept: application/json

### 商品登録

POST {{SalesSystem.Api_HostAddress}}/products
Content-Type: application/json

{
  "code": "P001",
  "name": "コピー用紙 A4",
  "unitPrice": 500
}
```
