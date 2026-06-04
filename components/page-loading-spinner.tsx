import { LoaderCircle } from "lucide-react";

export function PageLoadingSpinner() {
  return (
    <div className="min-h-[240px] w-full flex items-center justify-center" role="status" aria-label="Loading">
      <LoaderCircle size={32} className="animate-spin text-emerald-400" />
    </div>
  );
}
