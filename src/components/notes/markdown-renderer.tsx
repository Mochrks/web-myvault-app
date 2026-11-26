"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

function MarkdownCodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = React.useState(false);
  const [highlightedHtml, setHighlightedHtml] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    if (!language || code.length > 50_000) {
      return;
    }

    import("shiki")
      .then(({ codeToHtml }) =>
        codeToHtml(code, {
          lang: language,
          theme: "github-dark-default",
        })
      )
      .then((html) => {
        if (active) setHighlightedHtml(html);
      })
      .catch(() => {
        if (active) setHighlightedHtml(null);
      });

    return () => {
      active = false;
    };
  }, [code, language]);

  const renderedHtml = language && code.length <= 50_000 ? highlightedHtml : null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Code block copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Failed to copy code block");
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-3.5 py-1.5 text-[11px] text-muted-foreground">
        <span className="font-mono uppercase">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy code
            </>
          )}
        </button>
      </div>
      {renderedHtml ? (
        <div
          className="overflow-x-auto [&_pre]:m-0 [&_pre]:!bg-transparent [&_pre]:p-3.5 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:leading-6"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      ) : (
        <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-6 text-foreground/90">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="vault-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            return <>{children}</>;
          },
          code({ className, children, ...props }) {
            const match = /language-([\w-]+)/.exec(className || "");
            const rawText = String(children).replace(/\n$/, "");
            const isBlock = Boolean(match) || rawText.includes("\n");

            if (isBlock) {
              return <MarkdownCodeBlock language={match?.[1] ?? "plaintext"} code={rawText} />;
            }

            return (
              <code
                className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[0.84em] text-foreground"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
