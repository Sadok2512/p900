import type { ReactNode } from "react";
import { conditionTone } from "@/lib/polaris-ui/conditionTone";

type Props = { field: string; value: string; op?: string; size?: "sm" | "md"; className?: string; children?: ReactNode };

/** Shared query-condition chip; colour follows the condition category (not operational status). */
export function ConditionBadge({ field, value, op = "=", size = "sm", className = "", children }: Props) {
  const label = `${field} ${op} ${value}`;
  const h = size === "md" ? "h-8 text-[12.5px] px-2.5" : "h-[22px] text-[11.5px] px-2";
  return (
    <span data-cond={conditionTone(field, value)} title={label} className={`polaris-cond inline-flex items-center gap-1 max-w-full rounded-md border whitespace-nowrap ${h} ${className}`}>
      <span className="opacity-75">{field}</span><span className="opacity-60">{op}</span><span className="font-medium truncate">{value}</span>
      {children}
    </span>
  );
}
