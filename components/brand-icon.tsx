import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandIcon({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden bg-emerald-500 text-white",
        className,
        "rounded-[28%]"
      )}
      style={{ width: size, height: size }}
    >
      <Inbox size={Math.round(size * 0.58)} strokeWidth={2.5} />
    </span>
  );
}
