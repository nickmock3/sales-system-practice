import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
};

export function Input({ className, hasError = false, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "ui-input h-10 w-full rounded-md border bg-white px-3 text-sm text-slate-950 shadow-xs outline-none transition-colors placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
        hasError
          ? "border-red-500 focus:border-red-600"
          : "border-slate-300 focus:border-teal-600",
        className,
      )}
      aria-invalid={hasError || undefined}
      {...props}
    />
  );
}
