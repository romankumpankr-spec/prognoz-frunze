"use client";

import { usePathname, useRouter } from "next/navigation";

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/" || pathname === "/login") return null;
  return <nav className="site-nav" aria-label="Разделы турнира">
    <button className={pathname === "/dashboard" ? "nav-tab active" : "nav-tab"} onClick={() => router.push("/dashboard")}>⚽ Прогнозы</button>
    <button className={pathname.startsWith("/teams") ? "nav-tab active" : "nav-tab"} onClick={() => router.push("/teams")}>🏆 6 команд</button>
  </nav>;
}
