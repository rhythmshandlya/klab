import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { AppShell } from "@/components/app-shell/app-shell";
import { getAuthCapabilities, isAuthConfigured } from "@/lib/env";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "klab — learn Kubernetes by doing",
    template: "%s · klab",
  },
  description:
    "A gamified, hands-on Kubernetes learning platform. Debug broken clusters, experiment in a sandbox, and study interactive lessons — all simulated in your browser.",
  applicationName: "klab",
  keywords: ["kubernetes", "k8s", "learning", "debugging", "sandbox", "devtools"],
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const authCapabilities = getAuthCapabilities();

  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        {/* Whether accounts are available is a server-side fact (env); pass it down so
            the client nav shows sign-in only when the backend is actually configured. */}
        <AppShell authEnabled={isAuthConfigured()} authCapabilities={authCapabilities}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
