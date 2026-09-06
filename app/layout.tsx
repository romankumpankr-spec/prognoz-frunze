import type { Metadata } from "next";
import "./globals.css";
import AppNav from "../components/app-nav";

export const metadata: Metadata = {
  title: "Прогноз-Фрунзе",
  description: "Закрытая лига прогнозов Лиги чемпионов",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body><AppNav />{children}</body>
    </html>
  );
}
