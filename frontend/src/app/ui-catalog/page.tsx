import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  LoaderCircle,
  LockKeyhole,
  Save,
  Search,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

const products = [
  {
    code: "P-1001",
    name: "標準デスク",
    taxCategory: "課税",
    price: "48,000",
    status: "有効",
  },
  {
    code: "P-2040",
    name: "保守サービス月額",
    taxCategory: "課税",
    price: "12,000",
    status: "履歴あり",
    selected: true,
  },
  {
    code: "P-3099",
    name: "非課税教材",
    taxCategory: "非課税",
    price: "8,500",
    status: "確認中",
  },
];

function CatalogSection({
  children,
  description,
  title,
  className,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "surface section-pad",
        className,
      )}
    >
      <div className="section-heading">
        <h2>{title}</h2>
        {description ? (
          <p>{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function UiCatalogPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="app-shell flex flex-col gap-6">
        <header className="surface surface-pad">
          <nav
            aria-label="breadcrumb"
            className="flex items-center gap-1 text-sm font-semibold text-slate-500"
          >
            <Link className="hover:text-teal-700" href="/">
              販売管理システム
            </Link>
            <ChevronRight aria-hidden="true" className="size-4" />
            <span className="text-slate-700">UI カタログ</span>
          </nav>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div>
              <h1 className="text-3xl font-bold leading-tight">UI カタログ</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                業務画面で使う共通 UI の密度、余白、状態表示を確認する静的カタログです。
                実画面で使う部品だけを、同じ基準で並べます。
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 surface-pad">
              <p className="text-xs font-bold text-slate-500">認証 UI サンプル</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="secondary">一般ユーザー</Button>
                <Button>管理者</Button>
                <Button variant="ghost">ログアウト</Button>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <CatalogSection
            description="一覧、選択中行、金額、税区分、状態を同じ密度で確認します。"
            title="Tables"
          >
            <div className="overflow-x-auto">
              <table className="data-table text-left">
                <thead>
                  <tr>
                    <th className="w-32">商品コード</th>
                    <th>商品名</th>
                    <th className="w-24">税区分</th>
                    <th className="w-32 text-right">標準単価</th>
                    <th className="w-28">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr
                      className={cn(
                        "hover:bg-slate-50",
                        product.selected && "data-table-row-selected",
                      )}
                      key={product.code}
                    >
                      <td className="font-mono text-slate-700">
                        {product.code}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{product.name}</span>
                          {product.selected ? (
                            <Badge tone="info">選択中</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="text-slate-700">
                        {product.taxCategory}
                      </td>
                      <td className="text-right font-mono">
                        {product.price} 円
                      </td>
                      <td>
                        <Badge
                          tone={
                            product.status === "有効"
                              ? "success"
                              : product.status === "確認中"
                                ? "warning"
                                : "info"
                          }
                        >
                          {product.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CatalogSection>

          <div className="grid gap-6">
            <CatalogSection description="操作の優先度を見比べます。" title="Actions">
              <div className="grid gap-4">
                <div>
                  <p className="mb-2 text-xs font-bold text-slate-500">
                    主要操作
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button>
                      <Save aria-hidden="true" className="size-4" />
                      登録
                    </Button>
                    <Button disabled>
                      <LoaderCircle aria-hidden="true" className="size-4" />
                      送信中
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold text-slate-500">
                    補助操作
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary">
                      <Search aria-hidden="true" className="size-4" />
                      検索
                    </Button>
                    <Button variant="ghost">キャンセル</Button>
                  </div>
                </div>
              </div>
            </CatalogSection>

            <CatalogSection description="小さく、意味だけを伝えます。" title="Status">
              <div className="flex flex-wrap gap-2">
                <Badge tone="success">有効</Badge>
                <Badge tone="warning">確認中</Badge>
                <Badge tone="danger">権限不足</Badge>
                <Badge tone="neutral">未選択</Badge>
              </div>
            </CatalogSection>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,520px)_1fr]">
          <CatalogSection
            description="ラベル、補足、エラーを近接させ、縦に伸びすぎない配置にします。"
            title="Forms"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold">
                商品名
                <Input defaultValue="標準デスク" />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                適用開始日
                <Input defaultValue="2026-06-05" type="date" />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                作成者
                <Input defaultValue="管理者" disabled />
                <span className="text-xs font-medium text-slate-500">
                  システムが設定するため編集できません。
                </span>
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                標準単価
                <Input
                  aria-describedby="unit-price-error"
                  defaultValue="-100"
                  hasError
                  inputMode="numeric"
                />
                <span
                  className="text-sm font-medium text-red-700"
                  id="unit-price-error"
                >
                  標準単価は 0 円以上で入力してください。
                </span>
              </label>
            </div>
          </CatalogSection>

          <div className="grid gap-6 lg:grid-cols-2">
            <CatalogSection
              description="成功・入力エラー・通信エラーの表示を分けて確認します。"
              title="Feedback"
            >
              <div className="grid gap-3">
                <Alert title="登録しました" tone="success">
                  商品履歴を追加し、一覧を更新しました。
                </Alert>
                <Alert title="入力内容を確認してください" tone="danger">
                  赤字の項目を修正してから再度登録してください。
                </Alert>
                <Alert title="通信できません" tone="danger">
                  バックエンド API が起動しているか確認してください。
                </Alert>
              </div>
            </CatalogSection>

            <CatalogSection
              description="データ取得中と検索結果なしを同じ幅で確認します。"
              title="Async / Empty"
            >
              <div className="grid gap-3">
                <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-xs">
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin text-slate-500"
                    />
                    読み込み中
                  </span>
                  <p className="mt-1 text-slate-600">
                    一覧データの取得中は操作領域の高さを保ちます。
                  </p>
                </div>
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                  <Check
                    aria-hidden="true"
                    className="mx-auto size-5 text-slate-500"
                  />
                  <p className="mt-2 text-sm font-semibold">該当データなし</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    検索条件を変更するか、新しい履歴を追加してください。
                  </p>
                </div>
              </div>
            </CatalogSection>
          </div>
        </div>

        <CatalogSection
          description="画面上部の実操作ではなく、状態サンプルとして確認します。"
          title="Auth States"
        >
          <div className="grid gap-3 lg:grid-cols-3">
            <Alert title="管理者" tone="success">
              <span className="inline-flex items-center gap-2">
                <Check aria-hidden="true" className="size-4" />
                マスタの登録と履歴追加ができます。
              </span>
            </Alert>
            <Alert title="一般ユーザー" tone="info">
              参照操作を中心に利用できます。更新操作は非表示または無効にします。
            </Alert>
            <Alert title="ログアウト" tone="danger">
              <span className="inline-flex items-center gap-2">
                <LockKeyhole aria-hidden="true" className="size-4" />
                認証が必要な API ではエラーを表示します。
              </span>
            </Alert>
          </div>
        </CatalogSection>

        <section className="surface section-pad border-amber-200">
          <div className="flex gap-3 text-sm text-amber-900">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4" />
            <div>
              <h2 className="font-bold">静的カタログ</h2>
              <p className="mt-1 leading-6 text-slate-700">
                このページは表示確認用です。フォーム送信やユーザー切り替えは、各業務画面または API クライアント整備時に実装します。
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
