import { apiBaseUrl } from "@/lib/config";
import styles from "./page.module.css";

const plannedAreas = ["商品マスタ", "得意先マスタ", "税率管理", "売上登録"];

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <p className={styles.kicker}>Sales System Practice</p>
        <h1>販売管理システム</h1>
        <p className={styles.description}>
          業務画面の実装を始めるための Next.js フロントエンド基盤です。
        </p>
      </section>

      <section className={styles.panel} aria-labelledby="environment-heading">
        <h2 id="environment-heading">接続設定</h2>
        <dl className={styles.settings}>
          <div>
            <dt>API Base URL</dt>
            <dd>{apiBaseUrl}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.panel} aria-labelledby="areas-heading">
        <h2 id="areas-heading">実装予定</h2>
        <ul className={styles.areaList}>
          {plannedAreas.map((area) => (
            <li key={area}>{area}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
