import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WOD — Plataforma do Coach",
  description: "Timer de WOD e gestão de treinos para personal e alunos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
