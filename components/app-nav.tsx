"use client";

import { usePathname, useRouter } from "next/navigation";

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  if (!["/dashboard", "/teams", "/champion", "/chat", "/admin", "/admin/champion"].includes(pathname)) return null;
  return (
    <nav className="app-nav" aria-label="Разделы турниров">
      <button className={pathname === "/dashboard" ? "active" : ""} onClick={() => router.push("/dashboard")}>⚽ Прогнозы</button>
      <button className={pathname === "/teams" ? "active" : ""} onClick={() => router.push("/teams")}>👕 6 команд</button>
      <button className={pathname === "/champion" ? "active" : ""} onClick={() => router.push("/champion")}>🏆 Победитель ЛЧ</button>
      <button className={pathname === "/chat" ? "active" : ""} onClick={() => router.push("/chat")}>💬 Личные сообщения</button>
      {pathname === "/admin" && <button className="active" onClick={() => router.push("/admin")}>⚙ Админка</button>}
      {pathname === "/admin/champion" && <button className="active" onClick={() => router.push("/admin/champion")}>⚙ Админка</button>}
    </nav>
  );
}
