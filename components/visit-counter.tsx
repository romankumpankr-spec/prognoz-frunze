"use client";

import { useEffect } from "react";
import { createClient } from "../lib/supabase/client";

export default function VisitCounter() {
  useEffect(() => {
    const supabase = createClient();
    const key = "prognoz-frunze-visit-session";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void supabase.rpc("record_site_visit");
  }, []);

  return null;
}
