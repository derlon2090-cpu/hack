"use client";

import { useEffect, useState } from "react";
import { Clapperboard, Download, Link2, ShieldCheck } from "lucide-react";
import { Toaster } from "sonner";
import { LanguageMenu } from "@/components/language-menu";
import { type Locale, localeDir } from "@/lib/i18n";
import { ff } from "@/lib/frameflow-i18n";

type SharedVideo = { id: string; title: string | null; sessionName: string; durationSeconds: number; shareExpiresAt: string };

export default function SharedVideoPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState("");
  const [video, setVideo] = useState<SharedVideo | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [status, setStatus] = useState<"loading" | "ready" | "expired">("loading");
  const t = ff[locale];

  useEffect(() => {
    const saved = localStorage.getItem("frameflow-locale") as Locale | null;
    if (saved && saved in ff) setLocale(saved);
    let active = true;
    params.then(({ token: current }) => {
      if (!active) return;
      setToken(current);
      fetch(`/api/share/${encodeURIComponent(current)}`, { cache: "no-store" }).then(async (response) => {
        if (!active) return;
        if (!response.ok) { setStatus("expired"); return; }
        setVideo(await response.json() as SharedVideo); setStatus("ready");
      }).catch(() => { if (active) setStatus("expired"); });
    });
    return () => { active = false; };
  }, [params]);

  return <main className={`landing-shell ${localeDir(locale) === "rtl" ? "rtl" : ""}`}><Toaster /><nav className="landing-nav"><div className="frame-logo"><span className="frame-logo-icon"><Clapperboard size={17} /></span><span>FrameFlow <span className="brand-light">Studio</span></span></div><LanguageMenu locale={locale} onChange={(next) => { setLocale(next); localStorage.setItem("frameflow-locale", next); }} /></nav><section className="landing-card share-page">{status === "loading" ? <div className="empty"><p>{t.saving}</p></div> : status === "expired" ? <><div className="landing-badge"><ShieldCheck size={13} />{t.expiredLink}</div><h1>{t.expiredLink}</h1><p className="landing-lead">{t.expiredLink}</p></> : video ? <><div className="landing-badge"><ShieldCheck size={13} />{t.shareExpiry} {new Date(video.shareExpiresAt).toLocaleDateString()}</div><h1>{video.title || video.sessionName}</h1><p className="landing-lead">{video.sessionName} · {video.durationSeconds} {t.seconds}</p><video className="video-preview" src={`/api/share/${encodeURIComponent(token)}/file`} controls playsInline preload="metadata" /><a className="primary share-download" href={`/api/share/${encodeURIComponent(token)}/file?download=1`}><Download size={15} />{t.download}</a></> : null}</section><footer className="landing-bottom"><span>FrameFlow Studio · {t.private}</span><span><Link2 size={12} /> {t.access}</span></footer></main>;
}
