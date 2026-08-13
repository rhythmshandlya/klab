import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { AppShell } from "@/components/app-shell/app-shell";
import { BRAND } from "@/config/brand";
import { getAuthCapabilities, isAuthConfigured } from "@/lib/env";
import { SITE_ORIGIN } from "@/lib/seo";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: `${BRAND.name}: ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  icons: {
    icon: BRAND.logo.assets.favicon,
    apple: BRAND.logo.assets.appIcon,
  },
  keywords: ["kubernetes", "k8s", "learning", "debugging", "sandbox", "devtools"],
};

export const viewport: Viewport = {
  themeColor: BRAND.logo.backgroundColor,
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const authCapabilities = getAuthCapabilities();
  const isVercelDeployment = process.env.VERCEL === "1";

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
        {isVercelDeployment ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  );
}
