import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const toneClassNames: Record<BadgeTone, string> = {
  neutral: "border-slate-300 bg-white text-slate-700",
  success: "border-emerald-300 bg-white text-emerald-700",
  warning: "border-amber-300 bg-white text-amber-700",
  danger: "border-red-300 bg-white text-red-700",
  info: "border-sky-300 bg-white text-sky-700",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "ui-badge inline-flex min-h-6 items-center rounded-md border px-2 text-xs font-semibold",
        toneClassNames[tone],
        className,
      )}
      {...props}
    />
  );
}
