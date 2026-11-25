import { Loader2, Lock } from "lucide-react";

export default function VaultLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-8 py-6">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted text-foreground">
          <Lock className="h-4 w-4" />
          <Loader2 className="absolute -right-1.5 -bottom-1.5 h-4 w-4 animate-spin rounded-full bg-background text-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            Loading your vault...
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Syncing metadata from private storage
          </p>
        </div>
      </div>
    </div>
  );
}
