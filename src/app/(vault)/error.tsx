"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function VaultErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              Something went wrong
            </h1>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {error.message ||
                "A temporary storage or network error interrupted this page."}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button asChild variant="outline" size="sm">
              <Link href="/files">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Files
              </Link>
            </Button>
            <Button type="button" size="sm" onClick={() => reset()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
