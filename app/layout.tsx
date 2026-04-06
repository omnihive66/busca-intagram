import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Catalogador de Imóveis",
  description: "Raspe Instagram e catalogue imóveis automaticamente com IA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-50 min-h-screen">{children}</body>
    </html>
  );
}
