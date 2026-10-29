"use client";
/* eslint @next/next/no-img-element: "off" */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownToLine, ArrowUpRight, Camera, CircleHelp, Clapperboard, Copy, Film, Image as ImageIcon, LayoutDashboard, Link2, LoaderCircle, LogOut, Plus, Search, Settings2, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { Toaster, toast } from "sonner";
import { LanguageMenu } from "@/components/language-menu";
import { type Locale, localeDir } from "@/lib/i18n";
import { ff, type FrameFlowCopy } from "@/lib/frameflow-i18n";
import { isSessionAvailable } from "@/lib/session-lifecycle";

type SessionRecord = { id: string; code: string; name: string; purpose: string | null; locale: Locale; active: boolean; expiresAt: string | null; retentionDays: number; views: number; createdAt: string; photoCount: number; videoCount: number; url?: string };
type PhotoRecord = { id: string; linkId: string | null; sessionId: string | null; sessionName: string | null; objectKey: string; mimeType: string; size: number; createdAt: string };
type VideoRecord = { id: string; sessionId: string; sessionName: string; photoId: string; objectKey: string; title: string | null; background: string; durationSeconds: number; size: number; shareToken: string | null; shareExpiresAt: string | null; createdAt: string };
type Tab = "overview" | "links" | "media" | "video" | "settings";

const navItems = [
  { id: "overview", key: "overview", icon: LayoutDashboard },
  { id: "create", key: "createSession", icon: Plus },
  { id: "links", key: "myLinks", icon: Link2 },
  { id: "media", key: "capturedMedia", icon: ImageIcon },
  { id: "video", key: "videoStudio", icon: Clapperboard },
  { id: "settings", key: "settings", icon: Settings2 }
] as const;

const sessionState = (s: SessionRecord): "active" | "expired" | "paused" => !s.active ? "paused" : isSessionAvailable(s.active, s.expiresAt) ? "active" : "expired";
const baseUrl = (code: string) => `${window.location.origin}/s/${code}`;

export default function FrameFlowDashboard() {
  const [locale, setLocale] = useState<Locale>("en");
  const [tab, setTab] = useState<Tab>("overview");
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sessionModal, setSessionModal] = useState(false);
  const [sessionCreated, setSessionCreated] = useState<SessionRecord | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState("");
  const [videoDuration, setVideoDuration] = useState(5);
  const [videoBackground, setVideoBackground] = useState("191827");
  const [videoTitle, setVideoTitle] = useState("");
  const [latestVideo, setLatestVideo] = useState<VideoRecord | null>(null);
  const [sharing, setSharing] = useState("");
  const [deleting, setDeleting] = useState("");
  const t = ff[locale];

  const loadData = useCallback(async () => {
    setPageError("");
    try {
      const [sessionResponse, photoResponse, videoResponse] = await Promise.all([
        fetch("/api/sessions", { cache: "no-store" }),
        fetch("/api/photos", { cache: "no-store" }),
        fetch("/api/videos", { cache: "no-store" })
      ]);
      if ([sessionResponse, photoResponse, videoResponse].some((response) => response.status === 401)) { window.location.replace("/login"); return; }
      if (![sessionResponse, photoResponse, videoResponse].every((response) => response.ok)) throw new Error(t.uploadFailure);
      setSessions(await sessionResponse.json() as SessionRecord[]);
      setPhotos(await photoResponse.json() as PhotoRecord[]);
      setVideos(await videoResponse.json() as VideoRecord[]);
    } catch { setPageError(t.uploadFailure); }
    finally { setLoading(false); }
  }, [t.uploadFailure]);

  useEffect(() => {
    const saved = localStorage.getItem("frameflow-locale") as Locale | null;
    if (saved && saved in ff) setLocale(saved);
    void loadData();
  }, [loadData]);

  const filteredSessions = useMemo(() => sessions.filter((s) => `${s.name} ${s.code} ${s.purpose || ""}`.toLowerCase().includes(search.toLowerCase()) && (statusFilter === "all" || sessionState(s) === statusFilter)), [sessions, search, statusFilter]);
  const activeCount = sessions.filter((s) => sessionState(s) === "active").length;

  async function createSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormBusy(true);
    const values = new FormData(event.currentTarget);
    const response = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: values.get("name"), locale: values.get("locale"), durationDays: Number(values.get("durationDays")), purpose: values.get("purpose"), retentionDays: Number(values.get("retentionDays")) }) }).catch(() => null);
    setFormBusy(false);
    const body = response?.ok ? await response.json() as SessionRecord : null;
    if (!body) { toast.error(t.processingError); return; }
    setSessionCreated(body); setSessions((current) => [body, ...current]); toast.success(t.created);
  }

  async function copySession(s: SessionRecord) {
    try { await navigator.clipboard.writeText(baseUrl(s.code)); toast.success(t.copiedToast); }
    catch { toast.error("Clipboard unavailable. Use Preview to copy the address."); }
  }

  async function setSessionActive(s: SessionRecord) {
    const response = await fetch(`/api/sessions/${s.code}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !s.active }) });
    if (!response.ok) { toast.error(t.processingError); return; }
    const updated = await response.json() as SessionRecord;
    setSessions((all) => all.map((item) => item.id === s.id ? { ...item, ...updated } : item)); toast.success(t.statusUpdated);
  }

  async function deleteSession(s: SessionRecord) {
    if (!window.confirm(t.confirmDelete)) return;
    setDeleting(s.id);
    const response = await fetch(`/api/sessions/${s.code}`, { method: "DELETE" }); setDeleting("");
    if (!response.ok) { toast.error(t.processingError); return; }
    setSessions((all) => all.filter((item) => item.id !== s.id));
    setPhotos((all) => all.filter((item) => item.sessionId !== s.id));
    setVideos((all) => all.filter((item) => item.sessionId !== s.id)); toast.success(t.deleted);
  }

  async function deletePhoto(photo: PhotoRecord) {
    if (!window.confirm(t.confirmDeletePhoto)) return;
    setDeleting(photo.id);
    const response = await fetch(`/api/photos/${photo.id}`, { method: "DELETE" }); setDeleting("");
    if (!response.ok) { toast.error(t.processingError); return; }
    setPhotos((all) => all.filter((item) => item.id !== photo.id));
    setVideos((all) => all.filter((video) => video.photoId !== photo.id)); toast.success(t.deleted);
  }

  async function createVideo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedPhoto) return;
    setVideoBusy(true); setLatestVideo(null);
    try {
      const response = await fetch("/api/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoId: selectedPhoto, durationSeconds: videoDuration, background: videoBackground, title: videoTitle }) });
      const body = await response.json() as VideoRecord | { error?: string };
      if (!response.ok || !("id" in body)) throw new Error("error" in body ? body.error : t.renderError);
      setLatestVideo(body); setVideos((all) => [body, ...all]); toast.success(t.saved);
    } catch (error) { toast.error(error instanceof Error && error.message ? error.message : t.renderError); }
    finally { setVideoBusy(false); }
  }

  async function createShare(video: VideoRecord) {
    setSharing(video.id);
    try {
      const response = await fetch(`/api/videos/${video.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ durationDays: 7 }) });
      const body = await response.json() as { url?: string; shareToken?: string; shareExpiresAt?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error || t.processingError);
      await navigator.clipboard.writeText(body.url);
      setVideos((all) => all.map((item) => item.id === video.id ? { ...item, shareToken: body.shareToken || null, shareExpiresAt: body.shareExpiresAt || null } : item));
      toast.success(t.shareReady);
    } catch (error) { toast.error(error instanceof Error && error.message ? error.message : t.processingError); }
    finally { setSharing(""); }
  }

  async function deleteVideo(video: VideoRecord) {
    if (!window.confirm(t.confirmDeleteVideo)) return;
    setDeleting(video.id);
    const response = await fetch(`/api/videos/${video.id}`, { method: "DELETE" }); setDeleting("");
    if (!response.ok) { toast.error(t.processingError); return; }
    setVideos((all) => all.filter((item) => item.id !== video.id));
    if (latestVideo?.id === video.id) setLatestVideo(null);
    toast.success(t.deleted);
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success(t.signOutConfirm); window.location.replace("/login");
  }

  function selectTab(id: string) {
    if (id === "create") { setSessionCreated(null); setSessionModal(true); return; }
    setTab(id as Tab);
  }

  return <div className={`app-shell frame-shell ${localeDir(locale) === "rtl" ? "rtl" : ""}`}>
    <Toaster position="bottom-right" richColors />
    <aside className="sidebar frame-sidebar">
      <div className="frame-logo frame-sidebar-brand"><span className="frame-logo-icon"><Clapperboard size={18} /></span><span>FrameFlow <span className="brand-light">Studio</span></span></div>
      <div className="side-label">{t.private.toUpperCase()} WORKSPACE</div>
      <nav aria-label={t.brand}>{navItems.map((item) => {
        const ItemIcon = item.icon;
        return <button key={item.id} className={`nav-item ${tab === item.id || item.id === "create" && sessionModal ? "selected" : ""}`} onClick={() => selectTab(item.id)}><ItemIcon size={16} /><span>{t[item.key]}</span></button>;
      })}</nav>
      <div className="side-bottom"><div className="online"><span className="online-dot" /><span>{t.access}</span></div><div className="user-card"><div className="avatar"><Clapperboard size={14} /></div><div className="user-copy"><div className="user-name">FrameFlow</div><div className="user-role">{t.private}</div></div><button className="icon-plain" onClick={() => void signOut()} aria-label={t.signOut} title={t.signOut}><LogOut size={15} /></button></div></div>
    </aside>
    <main className="main">
      <div className="page-top"><div><div className="eyebrow">FRAMEFLOW · {tab === "overview" ? t.overview.toUpperCase() : t[navItems.find((item) => item.id === tab)?.key || "overview"].toUpperCase()}</div><h1 className="page-title">{tab === "overview" ? t.dashboard : t[navItems.find((item) => item.id === tab)?.key || "overview"]}</h1><p className="page-subtitle">{tab === "overview" ? t.dashboardHint : tab === "links" ? t.sessionHint : tab === "settings" ? t.settingCopy : t.dashboardHint}</p></div><button className="primary" onClick={() => { setSessionCreated(null); setSessionModal(true); }}><Plus size={15} />{t.newSession}</button></div>

      <div className="stats-grid"><Stat icon={<Activity size={15} />} label={t.activeSessions} value={loading ? "—" : activeCount} foot={t.activeSessionsHint} /><Stat icon={<Link2 size={15} />} label={t.linksCreated} value={loading ? "—" : sessions.length} foot={t.viewsHint} /><Stat icon={<Film size={15} />} label={t.videosSaved} value={loading ? "—" : videos.length} foot={t.videoHint} /></div>

      {pageError && <div className="error-note" role="alert"><CircleHelp size={14} /> {pageError} <button className="secondary" onClick={() => void loadData()}>{t.done}</button></div>}
      {tab === "overview" && <Overview sessions={sessions.slice(0, 5)} loading={loading} locale={locale} onCreate={() => { setSessionCreated(null); setSessionModal(true); }} onSeeAll={() => setTab("links")} onCopy={copySession} onToggle={setSessionActive} t={t} />}
      {tab === "links" && <SessionTable sessions={filteredSessions} loading={loading} search={search} setSearch={setSearch} filter={statusFilter} setFilter={setStatusFilter} locale={locale} onCopy={copySession} onToggle={setSessionActive} onDelete={deleteSession} deleting={deleting} t={t} />}
      {tab === "media" && <MediaLibrary photos={photos} locale={locale} deleting={deleting} onDelete={deletePhoto} t={t} />}
      {tab === "video" && <VideoStudio photos={photos} videos={videos} latest={latestVideo} busy={videoBusy} selectedPhoto={selectedPhoto} setSelectedPhoto={setSelectedPhoto} duration={videoDuration} setDuration={setVideoDuration} background={videoBackground} setBackground={setVideoBackground} title={videoTitle} setTitle={setVideoTitle} onSubmit={createVideo} onShare={createShare} onDelete={deleteVideo} sharing={sharing} deleting={deleting} t={t} />}
      {tab === "settings" && <SettingsPanel locale={locale} onLocale={setLocale} t={t} />}
      <div className="footer">FrameFlow Studio <span style={{ opacity: .5 }}>·</span> {t.access}<span style={{ float: locale === "ar" ? "left" : "right" }}><LanguageMenu locale={locale} onChange={(next) => { setLocale(next); localStorage.setItem("frameflow-locale", next); }} /></span></div>
    </main>

    {sessionModal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSessionModal(false); }}><section className="modal frame-modal" role="dialog" aria-modal="true" aria-labelledby="session-modal-title"><div className="modal-head"><span className="frame-logo-icon"><Camera size={17} /></span><button className="icon-plain" aria-label={t.cancel} onClick={() => setSessionModal(false)}><X size={17} /></button></div>{sessionCreated ? <><div className="frame-kicker">{t.sessionCreated}</div><h2 className="modal-title" id="session-modal-title">{sessionCreated.name}</h2><p className="modal-hint">{t.privacy}</p><div className="share-link-box"><Link2 size={15} /><span>{baseUrl(sessionCreated.code)}</span><button className="icon-plain" onClick={() => void copySession(sessionCreated)} aria-label={t.copy}><Copy size={15} /></button></div><div className="modal-actions"><a className="secondary" target="_blank" rel="noreferrer" href={`/s/${sessionCreated.code}`}><ArrowUpRight size={14} />{t.preview}</a><button className="primary" onClick={() => setSessionModal(false)}>{t.done}</button></div></> : <><h2 className="modal-title" id="session-modal-title">{t.createSession}</h2><p className="modal-hint">{t.privacy}</p><form onSubmit={(event) => void createSession(event)}><label className="form-label" htmlFor="session-name">{t.name}</label><input className="form-input" id="session-name" name="name" required maxLength={100} placeholder={t.nameHint} />
        <div className="form-two"><div><label className="form-label" htmlFor="session-locale">{t.language}</label><select className="form-input" name="locale" id="session-locale" defaultValue={locale}><option value="ar">العربية</option><option value="en">English</option><option value="zh">简体中文</option></select></div><div><label className="form-label" htmlFor="duration-days">{t.expiry}</label><select className="form-input" name="durationDays" id="duration-days" defaultValue="7"><option value="1">{t.oneDay}</option><option value="7">{t.sevenDays}</option><option value="30">{t.thirtyDays}</option><option value="0">{t.never}</option></select></div></div>
        <label className="form-label" htmlFor="session-purpose">{t.purpose}</label><textarea className="form-input form-textarea" id="session-purpose" name="purpose" maxLength={240} placeholder={t.purposeHint} />
        <label className="form-label" htmlFor="retention-days">{t.retention}</label><select className="form-input" name="retentionDays" id="retention-days" defaultValue="30"><option value="7">7 {t.retentionDays}</option><option value="30">30 {t.retentionDays}</option><option value="90">90 {t.retentionDays}</option><option value="180">180 {t.retentionDays}</option><option value="365">365 {t.retentionDays}</option></select>
        <div className="privacy-panel" style={{ marginTop: 15 }}><ShieldCheck size={14} style={{ verticalAlign: "middle", marginRight: 7, color: "#22d3ee" }} />{t.privacy}</div><div className="modal-actions"><button type="button" className="secondary" onClick={() => setSessionModal(false)}>{t.cancel}</button><button className="primary" disabled={formBusy}>{formBusy && <LoaderCircle className="spin-icon" size={14} />}{formBusy ? t.creating : t.create}</button></div></form></>}</section></div>}
    <span className="sr-only" aria-live="polite">{loading ? t.saving : ""}</span>
  </div>;
}

function Stat({ icon, label, value, foot }: { icon: React.ReactNode; label: string; value: string | number; foot: string }) {
  return <div className="stat-card"><div className="stat-heading">{label}<span className="stat-icon">{icon}</span></div><div className="stat-number">{value}</div><div className="stat-foot">{foot}</div></div>;
}

function Overview({ sessions, loading, locale, onCreate, onSeeAll, onCopy, onToggle, t }: { sessions: SessionRecord[]; loading: boolean; locale: Locale; onCreate: () => void; onSeeAll: () => void; onCopy: (s: SessionRecord) => void; onToggle: (s: SessionRecord) => void; t: FrameFlowCopy }) {
  return <section><div className="section-top"><div><h2 className="section-title">{t.allSessions}</h2><p className="section-hint">{t.sessionHint}</p></div><button className="secondary" onClick={onSeeAll}>{t.myLinks}<ArrowUpRight size={13} /></button></div>{loading ? <SkeletonRows /> : sessions.length ? <div className="table-wrap"><SessionRows sessions={sessions} locale={locale} onCopy={onCopy} onToggle={onToggle} onDelete={() => {}} deleting="" t={t} compact /></div> : <EmptyState title={t.emptyTitle} hint={t.emptyHint} action={t.start} onClick={onCreate} />}</section>;
}

function SessionTable({ sessions, loading, search, setSearch, filter, setFilter, locale, onCopy, onToggle, onDelete, deleting, t }: { sessions: SessionRecord[]; loading: boolean; search: string; setSearch: (s: string) => void; filter: string; setFilter: (s: string) => void; locale: Locale; onCopy: (s: SessionRecord) => void; onToggle: (s: SessionRecord) => void; onDelete: (s: SessionRecord) => void; deleting: string; t: FrameFlowCopy }) {
  const noFilter = search.length === 0 && filter === "all";
  return (
    <section>
      <div className="section-top">
        <div><h2 className="section-title">{t.allSessions}</h2><p className="section-hint">{t.sessionHint}</p></div>
        <div className="table-tools">
          <label className="search-box"><Search size={13} /><input className="input" aria-label={t.search} placeholder={t.search} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <select className="filter-select" aria-label={t.status} value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">{t.all}</option><option value="active">{t.active}</option><option value="paused">{t.paused}</option><option value="expired">{t.expired}</option></select>
        </div>
      </div>
      {loading ? <SkeletonRows /> : sessions.length > 0 ? (
        <div className="table-wrap"><SessionRows sessions={sessions} locale={locale} onCopy={onCopy} onToggle={onToggle} onDelete={onDelete} deleting={deleting} t={t} /></div>
      ) : (
        <EmptyState title={noFilter ? t.emptyTitle : t.tableSearch} hint={noFilter ? t.emptyHint : t.emptySearch} action={noFilter ? t.start : undefined} onClick={noFilter ? () => setFilter("all") : undefined} />
      )}
    </section>
  );
}

function SessionRows({ sessions, locale, onCopy, onToggle, onDelete, deleting, t, compact = false }: { sessions: SessionRecord[]; locale: Locale; onCopy: (s: SessionRecord) => void; onToggle: (s: SessionRecord) => void; onDelete: (s: SessionRecord) => void; deleting: string; t: FrameFlowCopy; compact?: boolean }) {
  const dateLocale = locale === "ar" ? "ar-SA" : locale === "zh" ? "zh-CN" : "en-US";
  return <table><thead><tr><th>{t.name}</th><th>{t.status}</th><th>{t.createdAt}</th><th>{t.views}</th><th>{t.media}</th><th>{t.actions}</th></tr></thead><tbody>{sessions.map((s) => { const state = sessionState(s); return <tr key={s.id}><td className="session-first-cell"><div className="link-cell"><div className="link-icon"><Camera size={14} /></div><div><div className="link-title">{s.name}</div><div className="link-sub">/s/{s.code}</div></div></div></td><td><span className={`pill ${state !== "active" ? "inactive" : ""} ${state === "expired" ? "status-amber" : ""}`}>{t[state]}</span></td><td>{new Intl.DateTimeFormat(dateLocale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(s.createdAt))}</td><td>{s.views.toLocaleString(locale === "ar" ? "ar-SA" : locale === "zh" ? "zh-CN" : "en-US")}</td><td><span className="media-count"><ImageIcon size={12} /> {s.photoCount} <Film size={12} /> {s.videoCount}</span></td><td><div className="row-actions"><button className="icon-plain" title={t.copy} aria-label={t.copy} onClick={() => onCopy(s)}><Copy size={14} /></button><a className="icon-plain" href={`/s/${s.code}`} target="_blank" rel="noreferrer" aria-label={t.preview} title={t.preview}><ArrowUpRight size={14} /></a>{!compact && <><button className="icon-plain" onClick={() => onToggle(s)} disabled={state === "expired" && s.active} title={s.active ? t.revoke : t.restore} aria-label={s.active ? t.revoke : t.restore}><Activity size={14} /></button><button className="icon-plain danger-icon" onClick={() => onDelete(s)} disabled={deleting === s.id} aria-label={t.delete} title={t.delete}><Trash2 size={14} /></button></>}</div></td></tr>; })}</tbody></table>;
}

function EmptyState({ title, hint, action, onClick }: { title: string; hint: string; action?: string; onClick?: () => void }) {
  return <div className="empty frame-empty"><div className="empty-icon"><Clapperboard size={19} /></div><strong>{title}</strong><p>{hint}</p>{action && onClick && <button className="primary empty-action" onClick={onClick}><Plus size={14} />{action}</button>}</div>;
}

function SkeletonRows() {
  return <div className="skeleton-list" aria-label="Loading sessions">{Array.from({ length: 3 }, (_, index) => <div className="skeleton-row" key={index}><span /><span /><span /><span /></div>)}</div>;
}

function MediaLibrary({ photos, locale, deleting, onDelete, t }: { photos: PhotoRecord[]; locale: Locale; deleting: string; onDelete: (p: PhotoRecord) => void; t: FrameFlowCopy }) {
  if (!photos.length) return <EmptyState title={t.noPhotos} hint={t.privacy} />;
  return <section><div className="section-top"><div><h2 className="section-title">{t.capturedPhotos}</h2><p className="section-hint">{t.private}</p></div><span className="pill">{photos.length} {t.photo}</span></div><div className="media-grid">{photos.map((photo) => <article className="media-card" key={photo.id}><div className="media-thumb"><img src={`/api/photos/${photo.id}`} alt={`${t.photo} · ${photo.sessionName || "FrameFlow"}`} loading="lazy" /></div><div className="media-card-copy"><strong>{photo.sessionName || t.brand}</strong><span>{new Date(photo.createdAt).toLocaleDateString(locale === "ar" ? "ar-SA" : locale === "zh" ? "zh-CN" : "en-US")} · {(photo.size / 1024).toFixed(0)} KB</span><button className="icon-plain danger-icon" onClick={() => onDelete(photo)} disabled={deleting === photo.id} aria-label={t.deletePhoto}><Trash2 size={14} />{t.deletePhoto}</button></div></article>)}</div></section>;
}

function VideoStudio(props: { photos: PhotoRecord[]; videos: VideoRecord[]; latest: VideoRecord | null; busy: boolean; selectedPhoto: string; setSelectedPhoto: (id: string) => void; duration: number; setDuration: (n: number) => void; background: string; setBackground: (color: string) => void; title: string; setTitle: (text: string) => void; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; onShare: (video: VideoRecord) => void; onDelete: (video: VideoRecord) => void; sharing: string; deleting: string; t: FrameFlowCopy }) {
  const { photos, videos, latest, busy, selectedPhoto, setSelectedPhoto, duration, setDuration, background, setBackground, title, setTitle, onSubmit, onShare, onDelete, sharing, deleting, t } = props;
  return <section className="video-studio-layout"><div className="video-config"><div className="section-top"><div><h2 className="section-title">{t.videoStudio}</h2><p className="section-hint">{t.videoHint}</p></div><span className="stat-icon"><Sparkles size={15} /></span></div><form onSubmit={onSubmit}><label className="form-label" htmlFor="photo-select">{t.choosePhoto}</label><select className="form-input" id="photo-select" value={selectedPhoto} onChange={(e) => setSelectedPhoto(e.target.value)} required><option value="">{t.choosePhoto}</option>{photos.map((photo) => <option key={photo.id} value={photo.id}>{photo.sessionName || t.brand} · {new Date(photo.createdAt).toLocaleDateString()}</option>)}</select>{!photos.length && <p className="form-hint">{t.noSessionMedia}</p>}<label className="form-label" htmlFor="video-duration">{t.duration}</label><select className="form-input" id="video-duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}><option value={3}>3 {t.seconds}</option><option value={5}>5 {t.seconds}</option><option value={10}>10 {t.seconds}</option></select><label className="form-label" htmlFor="video-background">{t.background}</label><div className="color-control"><input aria-label={t.background} type="color" value={`#${background}`} onChange={(e) => setBackground(e.target.value.slice(1))} /><span>#{background.toUpperCase()}</span></div><label className="form-label" htmlFor="video-title">{t.overlay}</label><input className="form-input" id="video-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={70} placeholder={t.overlayHint} /><button className="primary video-create-button" disabled={busy || !photos.length || !selectedPhoto}>{busy ? <><LoaderCircle className="spin-icon" size={15} />{t.processing}</> : <><Clapperboard size={15} />{t.makeVideo}</>}</button></form>{busy && <div className="progress-track"><span /></div>}</div><div className="video-output">{latest ? <VideoOutput video={latest} t={t} onShare={onShare} sharing={sharing} /> : <EmptyState title={t.myVideos} hint={t.noVideos} />}</div><div className="video-list"><div className="section-top"><div><h2 className="section-title">{t.myVideos}</h2><p className="section-hint">{videos.length} {t.video}</p></div></div>{videos.length ? <div className="video-grid">{videos.map((video) => <article className="video-card" key={video.id}><video className="video-preview" src={`/api/videos/${video.id}/file`} controls preload="metadata" /><div className="video-card-heading"><span className="video-card-title">{video.title || video.sessionName}</span><span className="pill">MP4</span></div><div className="video-metadata">{video.durationSeconds}s · {(video.size / 1024 / 1024).toFixed(1)} MB</div><div className="video-actions"><a className="secondary" href={`/api/videos/${video.id}/file?download=1`}><ArrowDownToLine size={13} />{t.download}</a><button className="secondary" onClick={() => onShare(video)} disabled={sharing === video.id}>{sharing === video.id ? <LoaderCircle className="spin-icon" size={13} /> : <Link2 size={13} />}{video.shareToken ? t.copied : t.share}</button><button className="icon-plain danger-icon" onClick={() => onDelete(video)} disabled={deleting === video.id} aria-label={t.delete}><Trash2 size={14} /></button></div>{video.shareExpiresAt && <div className="form-hint">{t.shareExpiry} {new Date(video.shareExpiresAt).toLocaleDateString()}</div>}</article>)}</div> : <p className="form-hint">{t.noVideos}</p>}</div></section>;
}

function VideoOutput({ video, t, onShare, sharing }: { video: VideoRecord; t: FrameFlowCopy; onShare: (v: VideoRecord) => void; sharing: string }) {
  return <div className="video-output-card"><div className="frame-kicker">MP4 · {t.saved}</div><h2 className="section-title">{video.title || video.sessionName}</h2><video className="video-preview output-preview" src={`/api/videos/${video.id}/file`} controls autoPlay /><div className="video-actions"><a className="primary" href={`/api/videos/${video.id}/file?download=1`}><ArrowDownToLine size={14} />{t.download}</a><button className="secondary" onClick={() => onShare(video)} disabled={sharing === video.id}><Link2 size={13} />{t.share}</button></div></div>;
}

function SettingsPanel({ locale, onLocale, t }: { locale: Locale; onLocale: (locale: Locale) => void; t: FrameFlowCopy }) {
  return <section className="settings-grid"><div className="privacy-panel settings-card"><span className="stat-icon"><ShieldCheck size={17} /></span><h2 className="section-title">{t.settingsTitle}</h2><p>{t.settingCopy}</p><p>{t.cameraDisclosure}</p></div><div className="privacy-panel settings-card"><span className="stat-icon"><Settings2 size={17} /></span><h2 className="section-title">Language</h2><p>العربية · English · 简体中文</p><LanguageMenu locale={locale} onChange={onLocale} /></div></section>;
}
