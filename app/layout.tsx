import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Прогноз-Фрунзе",
  description: "Закрытая лига прогнозов Лиги чемпионов",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
