"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import BlurText from "@/components/ui/BlurText";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [redirecting, setRedirecting] = React.useState(false);
  const [titleReady, setTitleReady] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMessage("Please enter your vault password.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      await apiRequest<{ authenticated: boolean }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setPassword("");
      setRedirecting(true);
      toast.success("Vault unlocked");
      router.replace(nextPath.startsWith("/") ? nextPath : "/dashboard");
      router.refresh();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Authentication failed.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
      <div className="flex flex-col items-center space-y-2 text-center">
        <BlurText
          text="myvault"
          animateBy="letters"
          direction="top"
          trigger="load"
          delay={80}
          blur={10}
          distance={24}
          onAnimationComplete={() => setTitleReady(true)}
          className="justify-center text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
        />
        <BlurText
          text="Enter your password to unlock your vault"
          animateBy="words"
          direction="top"
          trigger="load"
          delay={60}
          blur={8}
          distance={14}
          className="justify-center text-sm text-muted-foreground"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
        animate={
          titleReady
            ? { opacity: 1, y: 0, filter: "blur(0px)" }
            : { opacity: 0, y: 12, filter: "blur(6px)" }
        }
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={
          titleReady
            ? "rounded-lg border border-border bg-card/90 p-6 shadow-xs backdrop-blur-md"
            : "pointer-events-none rounded-lg border border-border bg-card/90 p-6 shadow-xs backdrop-blur-md"
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="vault-password"
              className="text-xs font-medium text-foreground"
            >
              Vault Password
            </label>
            <div className="relative">
              <Input
                id="vault-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                autoFocus
                disabled={loading || redirecting}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {errorMessage}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || redirecting}
          >
            {redirecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Opening Vault...
              </>
            ) : loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Unlock Vault"
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
