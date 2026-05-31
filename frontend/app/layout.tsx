import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { QueryProvider }   from "@/components/layout/QueryProvider";
import { AuthProvider }    from "@/components/layout/AuthProvider";
import { BrandingProvider } from "@/components/layout/BrandingProvider";
import { ThemeProvider }   from "@/components/layout/ThemeProvider";
import { CartHydrator }    from "@/components/layout/CartHydrator";
import { Toaster }         from "@/components/ui/sonner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const playfairDisplay = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
});

export const metadata: Metadata = {
  title: "DineLuxe - Restaurant OS",
  description: "Complete Restaurant Operating System",
  manifest: "/manifest.json",
  applicationName: "DineLuxe",
  appleWebApp: {
    capable: true,
    title: "DineLuxe",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A3C5E",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1A3C5E" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-152.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} antialiased`}
      >
        <QueryProvider>
          <AuthProvider>
            <BrandingProvider>
              <ThemeProvider>
                <CartHydrator />
                {children}
                <Toaster richColors position="top-right" />
              </ThemeProvider>
            </BrandingProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}