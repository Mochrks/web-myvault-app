import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "myvault",
    template: "myvault - %s",
  },
  description:
    "Encrypted-session personal vault for files, rich markdown notes, source code, and documents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full bg-sidebar font-sans text-foreground selection:bg-accent selection:text-foreground"
      >
        <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            className: "border border-border bg-popover text-popover-foreground shadow-xl",
          }}
        />
      </body>
    </html>
  );
}
