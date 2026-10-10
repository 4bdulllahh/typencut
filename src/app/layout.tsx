import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Typencut",
  description: "Type to weave through highway traffic. A low-poly speed-typing game.",
};

export const viewport: Viewport = { themeColor: "#ebdfc9" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
