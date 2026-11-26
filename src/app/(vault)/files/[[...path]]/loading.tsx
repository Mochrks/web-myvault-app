import { Skeleton } from "@/components/ui/skeleton";

export default function FilesLoading() {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Left Folder Tree Panel Skeleton (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card/35 lg:flex">
        <div className="flex h-11 items-center justify-between border-b border-border px-3">
          <Skeleton className="h-3.5 w-16" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-6 w-6 rounded-md" />
            <Skeleton className="h-6 w-6 rounded-md" />
            <Skeleton className="h-6 w-6 rounded-md" />
          </div>
        </div>
        <div className="border-b border-border/70 p-2">
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
        <div className="space-y-2 p-3">
          <Skeleton className="h-7 w-full rounded-md" />
          <Skeleton className="h-6 w-5/6 rounded-md" />
          <Skeleton className="ml-4 h-6 w-4/6 rounded-md" />
          <Skeleton className="ml-4 h-6 w-3/4 rounded-md" />
          <Skeleton className="h-6 w-4/5 rounded-md" />
          <Skeleton className="ml-4 h-6 w-3/5 rounded-md" />
          <Skeleton className="h-6 w-2/3 rounded-md" />
        </div>
      </aside>

      {/* Right File Table Skeleton */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-3.5 w-24" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-48 rounded-lg" />
              <Skeleton className="h-8 w-32 rounded-lg" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-4 border-b border-border bg-secondary/45 px-4 py-3">
              <Skeleton className="h-4 w-4 rounded-[4px]" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="ml-auto hidden h-3.5 w-14 sm:block" />
              <Skeleton className="hidden h-3.5 w-14 md:block" />
              <Skeleton className="hidden h-3.5 w-20 lg:block" />
              <Skeleton className="h-3.5 w-12" />
            </div>
            <div className="divide-y divide-border/70">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-3"
                >
                  <Skeleton className="h-4 w-4 rounded-[4px] shrink-0" />
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <Skeleton className="h-4 w-4 rounded shrink-0" />
                    <Skeleton
                      className="h-3.5"
                      style={{ width: `${38 + ((i * 17) % 36)}%` }}
                    />
                  </div>
                  <Skeleton className="hidden h-5 w-14 rounded-md sm:block" />
                  <Skeleton className="hidden h-3.5 w-14 md:block" />
                  <Skeleton className="hidden h-3.5 w-20 lg:block" />
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-6 w-6 rounded-md" />
                    <Skeleton className="h-6 w-6 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
