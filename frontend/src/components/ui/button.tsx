import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClassNames: Record<ButtonVariant, string> = {
  primary:
    "border-slate-900 bg-slate-900 text-white hover:bg-slate-700 disabled:border-slate-300 disabled:bg-slate-300",
  secondary:
    "border-slate-300 bg-white text-slate-900 hover:bg-slate-100 disabled:text-slate-400",
  ghost:
    "border-transparent bg-transparent text-slate-700 hover:bg-slate-100 disabled:text-slate-400",
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "ui-button inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed",
        variantClassNames[variant],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
