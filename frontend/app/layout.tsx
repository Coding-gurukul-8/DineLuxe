import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider }   from "@/components/layout/QueryProvider";
import { AuthProvider }    from "@/components/layout/AuthProvider";
import { BrandingProvider } from "@/components/layout/BrandingProvider";
import { ThemeProvider }   from "@/components/layout/ThemeProvider";
import { Toaster }         from "@/components/ui/sonner";

if (typeof globalThis.localStorage !== "undefined" && typeof (globalThis as any).localStorage.getItem !== "function") {
  try {
    delete (globalThis as any).localStorage;
  } catch {
    (globalThis as any).localStorage = undefined;
  }
}
 
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
 
export const metadata: Metadata = {
  title: "DineLuxe - Restaurant OS",
  description: "Complete Restaurant Operating System",
};
 
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <QueryProvider>
          <AuthProvider>
            <BrandingProvider>
              <ThemeProvider>
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
