"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function NoteErrorState({
  title,
  description,
  backHref = "/files",
  downloadHref,
  canRetry = true,
}: {
  title: string;
  description: string;
  backHref?: string;
  downloadHref?: string;
  canRetry?: boolean;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = React.useState(false);

  const handleRetry = () => {
    setRetrying(true);
    router.refresh();
    setTimeout(() => setRetrying(false), 1200);
  };

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button asChild variant="outline" size="sm">
              <Link href={backHref}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Files
              </Link>
            </Button>

            {downloadHref && (
              <Button asChild size="sm">
                <a href={downloadHref}>
                  <Download className="h-3.5 w-3.5" />
                  Download File
                </a>
              </Button>
            )}

            {canRetry && (
              <Button
                type="button"
                size="sm"
                onClick={handleRetry}
                disabled={retrying}
              >
                <RefreshCw
                  className={retrying ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
                />
                {retrying ? "Retrying..." : "Retry"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
