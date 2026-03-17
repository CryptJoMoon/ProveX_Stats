import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PRVX Adjusted Market Cap",
  description: "Live PRVX dashboard using on-chain total supply, dead-wallet exclusions, and a static OA deduction.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
