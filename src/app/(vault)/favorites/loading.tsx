import { Skeleton } from "@/components/ui/skeleton";

export default function FavoritesLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3.5 w-36" />
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
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-4 rounded-[4px] shrink-0" />
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <Skeleton className="h-4 w-4 rounded shrink-0" />
                <Skeleton
                  className="h-3.5"
                  style={{ width: `${35 + ((i * 19) % 38)}%` }}
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
  );
}
