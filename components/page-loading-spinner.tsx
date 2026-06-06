import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageLoadingSpinner({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      className={cn("w-full flex items-center justify-center", fullScreen ? "min-h-screen" : "min-h-[240px]")}
      role="status"
      aria-label="Loading"
    >
      <LoaderCircle size={32} className="animate-spin text-emerald-400" />
    </div>
  );
}
