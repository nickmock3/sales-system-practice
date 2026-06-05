import Link from "next/link";
import { apiBaseUrl } from "@/lib/config";
import { Button } from "@/components/ui/button";

const plannedAreas = [
  { href: "/products", label: "商品マスタ" },
  { href: "/customers", label: "得意先マスタ" },
  { href: "/tax-rates", label: "税率管理" },
  { href: "/customer-product-prices", label: "得意先別単価" },
  { href: "/sales", label: "売上登録" },
  { href: "/ui-catalog", label: "UI カタログ" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-2 text-sm font-bold text-teal-700">
              Sales System Practice
            </p>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
              販売管理システム
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              マスタ画面と売上画面を作るための Next.js フロントエンド基盤です。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary">一般ユーザー</Button>
            <Button>管理者</Button>
            <Button variant="ghost">ログアウト</Button>
          </div>
        </section>

        <section
          className="rounded-lg border border-slate-200 bg-white p-5"
          aria-labelledby="environment-heading"
        >
          <h2 id="environment-heading" className="text-lg font-bold">
            接続設定
          </h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[160px_1fr]">
            <dt className="font-semibold text-slate-600">API Base URL</dt>
            <dd className="break-all font-mono text-slate-950">{apiBaseUrl}</dd>
          </dl>
        </section>

        <section
          className="rounded-lg border border-slate-200 bg-white p-5"
          aria-labelledby="areas-heading"
        >
          <h2 id="areas-heading" className="text-lg font-bold">
            業務メニュー
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plannedAreas.map((area) => (
              <li key={area.href}>
                <Link
                  className="flex min-h-12 items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:border-teal-600 hover:bg-teal-50"
                  href={area.href}
                >
                  {area.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
