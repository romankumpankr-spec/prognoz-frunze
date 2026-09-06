import type { Metadata } from "next";
import "./globals.css";
import "./site-ui.css";
import AppNav from "../components/app-nav";
import LanguageSwitcher from "../components/language-switcher";

export const metadata: Metadata = {
  title: "Прогноз-Фрунзе",
  description: "Закрытая лига прогнозов Лиги чемпионов",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body><LanguageSwitcher /><AppNav />{children}</body>
    </html>
  );
}
