import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Planning+",
  description: "Tableau de bord de travail pour la prépa",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Planning+", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1220" },
  ],
};

// Résout le thème avant le premier rendu (évite le flash).
const themeScript = `(function(){try{var t=document.documentElement.dataset.pref||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pref = (await cookies()).get("pp-theme")?.value ?? "system";
  return (
    <html lang="fr" data-pref={pref} data-theme={pref === "dark" ? "dark" : "light"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${GeistSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
