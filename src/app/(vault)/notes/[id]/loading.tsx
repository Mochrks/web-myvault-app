import { Skeleton } from "@/components/ui/skeleton";

export default function NoteEditorLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Editor Formatting Toolbar Skeleton */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card/70 px-3">
        <div className="flex items-center gap-1">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>
        <Skeleton className="h-4 w-px" />
        <Skeleton className="h-6 w-24 rounded-md" />
        <Skeleton className="h-4 w-px" />
        <div className="flex items-center gap-1">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>
        <Skeleton className="hidden h-4 w-px sm:block" />
        <div className="hidden items-center gap-1 sm:flex">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>
      </div>

      {/* Document Prose Canvas Skeleton */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-9 sm:px-10">
          {/* Heading 1 */}
          <div className="space-y-3 border-b border-border pb-4">
            <Skeleton className="h-8 w-2/5 rounded-lg" />
          </div>

          {/* Paragraph 1 */}
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </div>

          {/* Subheading + Checklist */}
          <div className="space-y-3 pt-2">
            <Skeleton className="h-6 w-1/3 rounded-md" />
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3.5 w-3/5" />
              </div>
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3.5 w-1/2" />
              </div>
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            </div>
          </div>

          {/* Code Block Skeleton */}
          <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3.5 w-2/5" />
          </div>

          {/* Paragraph 2 */}
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>

      {/* Bottom Status Bar Skeleton */}
      <div className="flex h-8 shrink-0 items-center justify-between border-t border-border bg-card/50 px-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="hidden h-3 w-14 sm:block" />
        </div>
      </div>
    </div>
  );
}
