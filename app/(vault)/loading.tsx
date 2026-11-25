import { Loader2, Lock } from "lucide-react";

export default function VaultLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0d12] px-4 text-[#eef1f7]">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#232838] bg-[#11141c] px-8 py-7 shadow-2xl">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-400">
          <Lock className="h-5 w-5" />
          <Loader2 className="absolute -right-1.5 -bottom-1.5 h-5 w-5 animate-spin rounded-full bg-[#11141c] text-indigo-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold tracking-tight text-[#eef1f7]">
            Loading your vault...
          </p>
          <p className="mt-1 text-xs text-[#98a2b3]">
            Syncing encrypted metadata from private storage
          </p>
        </div>
      </div>
    </div>
  );
}
