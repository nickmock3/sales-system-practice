import { LoaderCircle } from "lucide-react";
import type { SaleResponse } from "../_types";
import { SaleRegisteredDetail } from "./sale-registered-detail";

type SaleDetailPanelProps = {
  readonly sale: SaleResponse | null;
  readonly isLoading: boolean;
  readonly errorMessage: string;
};

export function SaleDetailPanel({
  sale,
  isLoading,
  errorMessage,
}: SaleDetailPanelProps) {
  return (
    <section
      className="surface section-pad"
      aria-labelledby="sales-detail-heading"
    >
      <div className="section-heading">
        <h2 id="sales-detail-heading">売上詳細</h2>
        <p>一覧で選択した売上、または登録直後の売上を表示します。</p>
      </div>

      {errorMessage ? (
        <p className="mb-4 text-sm font-medium text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          詳細を読み込み中
        </p>
      ) : null}

      {!isLoading && sale ? (
        <SaleRegisteredDetail sale={sale} />
      ) : null}

      {!isLoading && !sale && !errorMessage ? (
        <div className="selected-empty">
          <p>売上未選択</p>
          <span>売上一覧から行を選択するか、売上を登録してください。</span>
        </div>
      ) : null}
    </section>
  );
}
