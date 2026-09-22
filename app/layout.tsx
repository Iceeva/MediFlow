import type { Metadata } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/providers";

// Atkinson Hyperlegible was designed for maximum character recognition: a deliberate fit for a medical product.
const font = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = { title: { default: "MediFlow", template: "%s | MediFlow" }, description: "Healthcare management for clinics, doctors, staff and patients." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.variable}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
