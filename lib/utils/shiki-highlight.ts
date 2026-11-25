import { codeToHtml } from "shiki";
import { getShikiLanguage } from "@/lib/utils/file-types";

const MAX_HIGHLIGHT_CHARS = 350_000;

export async function highlightCodeSafe(
  code: string,
  filename: string
): Promise<{ html: string | null; language: string }> {
  const language = getShikiLanguage(filename);
  if (code.length > MAX_HIGHLIGHT_CHARS) {
    return { html: null, language };
  }

  try {
    const html = await codeToHtml(code, {
      lang: language,
      theme: "github-dark-default",
    });
    return { html, language };
  } catch {
    try {
      const html = await codeToHtml(code, {
        lang: "plaintext",
        theme: "github-dark-default",
      });
      return { html, language: "plaintext" };
    } catch {
      return { html: null, language };
    }
  }
}
