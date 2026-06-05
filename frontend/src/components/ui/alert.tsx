import type { HTMLAttributes, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type AlertTone = "info" | "success" | "danger";

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  tone?: AlertTone;
  children: ReactNode;
};

const toneClassNames: Record<AlertTone, string> = {
  info: "border-sky-200 bg-white text-sky-900",
  success: "border-emerald-200 bg-white text-emerald-900",
  danger: "border-red-200 bg-white text-red-900",
};

const icons = {
  info: Info,
  success: CheckCircle2,
  danger: AlertCircle,
};

export function Alert({
  children,
  className,
  title,
  tone = "info",
  ...props
}: AlertProps) {
  const Icon = icons[tone];

  return (
    <div
      className={cn(
        "ui-alert flex gap-3 rounded-md border border-l-4 p-3 text-sm shadow-xs",
        toneClassNames[tone],
        className,
      )}
      role={tone === "danger" ? "alert" : "status"}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-semibold leading-5">{title}</p>
        <div className="mt-0.5 leading-6 text-slate-700">{children}</div>
      </div>
    </div>
  );
}
