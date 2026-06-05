import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <p className="app-brand-kicker">Sales System Practice</p>
            <p className="app-brand-title">販売管理システム</p>
          </div>
          <div className="app-header-actions" aria-label="ダミー認証状態">
            <Button variant="secondary">一般ユーザー</Button>
            <Button>管理者</Button>
            <Button variant="ghost">ログアウト</Button>
          </div>
        </div>
      </header>

      <div className="app-shell flex flex-col gap-6">
        <div className="page-intro">
          <h1>販売管理システム</h1>
          <p>
            マスタ画面と売上画面を実装していくための学習用フロントエンドです。
            ここから各業務画面と UI カタログへ移動します。
          </p>
        </div>

        <section
          className="surface section-pad"
          aria-labelledby="environment-heading"
        >
          <div className="section-heading">
            <h2 id="environment-heading">接続設定</h2>
            <p>フロントエンドが参照するバックエンド API の接続先です。</p>
          </div>
          <dl className="definition-list">
            <dt>API Base URL</dt>
            <dd>{apiBaseUrl}</dd>
          </dl>
        </section>

        <section
          className="surface section-pad"
          aria-labelledby="areas-heading"
        >
          <div className="section-heading">
            <h2 id="areas-heading">業務メニュー</h2>
            <p>実装予定の各業務画面と、共通 UI の確認ページです。</p>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plannedAreas.map((area) => (
              <li key={area.href}>
                <Link className="menu-link" href={area.href}>
                  <span>{area.label}</span>
                  <ChevronRight aria-hidden="true" className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
