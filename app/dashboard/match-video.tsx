"use client";

import { useMemo, useState } from "react";

type Props = { url?: string | null };

function getVideoId(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
    if (url.hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] || null;
      if (url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2] || null;
    }
  } catch {}
  return null;
}

export function MatchVideo({ url }: Props) {
  const [open, setOpen] = useState(false);
  const videoId = useMemo(() => (url ? getVideoId(url) : null), [url]);
  if (!videoId) return null;

  return <div className="match-video">
    <button type="button" className="match-video-toggle" onClick={() => setOpen(v => !v)} aria-expanded={open}>
      <span>🎬 Обзор матча</span><span>{open ? "▲" : "▼"}</span>
    </button>
    {open && <div className="match-video-frame">
      <iframe
        src={`https://www.youtube.com/embed/${encodeURIComponent(videoId)}`}
        title="Обзор матча на YouTube"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>}
  </div>;
}
