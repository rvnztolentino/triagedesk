import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-neutral-200">
      <LoaderCircle className="animate-spin text-emerald-500" size={40} />
    </div>
  );
}
