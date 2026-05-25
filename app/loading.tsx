function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-neutral-800/70 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <SkeletonBlock className="h-8 w-56" />
          <SkeletonBlock className="h-4 w-80 max-w-full" />
        </div>
        <SkeletonBlock className="h-10 w-36" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="bg-[#111111] border border-neutral-800 rounded-xl p-5">
            <SkeletonBlock className="mb-4 h-3 w-20" />
            <SkeletonBlock className="h-8 w-14" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#111111] border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-neutral-800 bg-[#151515]">
            <SkeletonBlock className="h-5 w-40" />
          </div>
          <div className="divide-y divide-neutral-800">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="p-5 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-3">
                  <SkeletonBlock className="h-4 w-2/3" />
                  <SkeletonBlock className="h-3 w-full" />
                </div>
                <SkeletonBlock className="h-3 w-14 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#111111] border border-neutral-800 rounded-2xl p-6 space-y-5">
          <SkeletonBlock className="h-5 w-32" />
          <SkeletonBlock className="h-7 w-4/5" />
          <SkeletonBlock className="h-24 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <SkeletonBlock className="h-20 w-full" />
            <SkeletonBlock className="h-20 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
