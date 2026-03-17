import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ProveX Market Cap",
  description: "Adjusted PRVX analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
