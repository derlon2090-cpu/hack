"use client";
/* eslint @next/next/no-img-element: "off" */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowUpRight, Camera, CircleHelp, Copy, Image as ImageIcon, LayoutDashboard, Link2, LoaderCircle, LogOut, Moon, Plus, Search, Settings2, ShieldCheck, Sun, Trash2, X } from "lucide-react";
import { Toaster, toast } from "sonner";
import { LanguageMenu } from "@/components/language-menu";
import { type Locale, localeDir } from "@/lib/i18n";
import { ff, type FrameFlowCopy } from "@/lib/frameflow-i18n";
import { isSessionAvailable } from "@/lib/session-lifecycle";
import { isTikTokVideoDestination } from "@/lib/destinations";
import { useTheme } from "@/components/theme-provider";

type SessionRecord = { id: string; code: string; name: string; purpose: string | null; destination: string | null; locale: Locale; active: boolean; expiresAt: string | null; retentionDays: number; views: number; createdAt: string; photoCount: number; url?: string };
type PhotoRecord = { id: string; linkId: string | null; sessionId: string | null; sessionName: string | null; objectKey: string; mimeType: string; size: number; createdAt: string };
type Tab = "overview" | "links" | "media" | "settings";

const navItems = [
  { id: "overview", key: "overview", icon: LayoutDashboard },
  { id: "create", key: "createSession", icon: Plus },
  { id: "links", key: "myLinks", icon: Link2 },
  { id: "media", key: "capturedMedia", icon: ImageIcon },
  { id: "settings", key: "settings", icon: Settings2 }
] as const;

const sessionState = (s: SessionRecord): "active" | "expired" | "paused" => !s.active ? "paused" : isSessionAvailable(s.active, s.expiresAt) ? "active" : "expired";
const baseUrl = (code: string) => `${window.location.origin}/s/${code}`;
const destinationHost = (value: string | null) => { try { return value ? new URL(value).hostname : ""; } catch { return ""; } };

export default function FrameFlowDashboard() {
  const [locale, setLocale] = useState<Locale>("en");
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("overview");
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sessionModal, setSessionModal] = useState(false);
  const [sessionCreated, setSessionCreated] = useState<SessionRecord | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [deleting, setDeleting] = useState("");
  const t = ff[locale];

  const loadData = useCallback(async () => {
    setPageError("");
    try {
      const [sessionResponse, photoResponse] = await Promise.all([
        fetch("/api/sessions", { cache: "no-store" }),
        fetch("/api/photos", { cache: "no-store" })
      ]);
      if ([sessionResponse, photoResponse].some((response) => response.status === 401)) { window.location.replace("/login"); return; }
      if (![sessionResponse, photoResponse].every((response) => response.ok)) throw new Error(t.uploadFailure);
      setSessions(await sessionResponse.json() as SessionRecord[]);
      setPhotos(await photoResponse.json() as PhotoRecord[]);
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
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const destination = String(values.get("destination") || "").trim();
    if (destination && !isTikTokVideoDestination(destination)) { toast.error(t.destinationInvalid); return; }
    setFormBusy(true);
    const response = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: values.get("name"), locale: values.get("locale"), durationDays: Number(values.get("durationDays")), purpose: values.get("purpose"), destination, retentionDays: Number(values.get("retentionDays")) }) }).catch(() => null);
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
    toast.success(t.deleted);
  }

  async function deletePhoto(photo: PhotoRecord) {
    if (!window.confirm(t.confirmDeletePhoto)) return;
    setDeleting(photo.id);
    const response = await fetch(`/api/photos/${photo.id}`, { method: "DELETE" }); setDeleting("");
    if (!response.ok) { toast.error(t.processingError); return; }
    setPhotos((all) => all.filter((item) => item.id !== photo.id));
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
    <Toaster position={locale === "ar" ? "bottom-left" : "bottom-right"} richColors />
    <aside className="sidebar frame-sidebar">
      <div className="frame-logo frame-sidebar-brand"><span className="frame-logo-icon"><ImageIcon size={18} /></span><span>FrameFlow <span className="brand-light">Studio</span></span></div>
      <div className="side-label">{t.private.toUpperCase()} WORKSPACE</div>
      <nav aria-label={t.brand}>{navItems.map((item) => {
        const ItemIcon = item.icon;
        return <button key={item.id} className={`nav-item ${tab === item.id || item.id === "create" && sessionModal ? "selected" : ""}`} onClick={() => selectTab(item.id)}><ItemIcon size={16} /><span>{t[item.key]}</span></button>;
      })}</nav>
      <div className="side-bottom"><div className="online"><span className="online-dot" /><span>{t.access}</span></div><div className="user-card"><div className="avatar"><ImageIcon size={14} /></div><div className="user-copy"><div className="user-name">FrameFlow</div><div className="user-role">{t.private}</div></div><button className="icon-plain" onClick={() => void signOut()} aria-label={t.signOut} title={t.signOut}><LogOut size={15} /></button></div></div>
    </aside>
    <main className="main">
      <div className="page-top"><div><div className="eyebrow">FRAMEFLOW · {tab === "overview" ? t.overview.toUpperCase() : t[navItems.find((item) => item.id === tab)?.key || "overview"].toUpperCase()}</div><h1 className="page-title">{tab === "overview" ? t.dashboard : t[navItems.find((item) => item.id === tab)?.key || "overview"]}</h1><p className="page-subtitle">{tab === "overview" ? t.dashboardHint : tab === "links" ? t.sessionHint : tab === "settings" ? t.settingCopy : t.dashboardHint}</p></div><button className="primary" onClick={() => { setSessionCreated(null); setSessionModal(true); }}><Plus size={15} />{t.newSession}</button></div>

      <div className="stats-grid"><Stat icon={<Activity size={15} />} label={t.activeSessions} value={loading ? "—" : activeCount} foot={t.activeSessionsHint} /><Stat icon={<Link2 size={15} />} label={t.linksCreated} value={loading ? "—" : sessions.length} foot={t.viewsHint} /><Stat icon={<ImageIcon size={15} />} label={t.photosSaved} value={loading ? "—" : photos.length} foot={t.photosHint} /></div>

      {pageError && <div className="error-note" role="alert"><CircleHelp size={14} /> {pageError} <button className="secondary" onClick={() => void loadData()}>{t.done}</button></div>}
      {tab === "overview" && <Overview sessions={sessions.slice(0, 5)} loading={loading} locale={locale} onCreate={() => { setSessionCreated(null); setSessionModal(true); }} onSeeAll={() => setTab("links")} onCopy={copySession} onToggle={setSessionActive} t={t} />}
      {tab === "links" && <SessionTable sessions={filteredSessions} loading={loading} search={search} setSearch={setSearch} filter={statusFilter} setFilter={setStatusFilter} locale={locale} onCopy={copySession} onToggle={setSessionActive} onDelete={deleteSession} deleting={deleting} t={t} />}
      {tab === "media" && <MediaLibrary photos={photos} locale={locale} deleting={deleting} onDelete={deletePhoto} t={t} />}
      {tab === "settings" && <SettingsPanel locale={locale} onLocale={setLocale} theme={theme} onThemeChange={setTheme} t={t} />}
      <div className="footer">FrameFlow Studio <span style={{ opacity: .5 }}>·</span> {t.access}<span style={{ float: locale === "ar" ? "left" : "right" }}><LanguageMenu locale={locale} onChange={(next) => { setLocale(next); localStorage.setItem("frameflow-locale", next); }} /></span></div>
    </main>

    {sessionModal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSessionModal(false); }}><section className="modal frame-modal" role="dialog" aria-modal="true" aria-labelledby="session-modal-title"><div className="modal-head"><span className="frame-logo-icon"><Camera size={17} /></span><button className="icon-plain" aria-label={t.cancel} onClick={() => setSessionModal(false)}><X size={17} /></button></div>{sessionCreated ? <><div className="frame-kicker">{t.sessionCreated}</div><h2 className="modal-title" id="session-modal-title">{sessionCreated.name}</h2><p className="modal-hint">{t.privacy}</p>{sessionCreated.destination && <p className="form-hint">{t.videoDestination}: {destinationHost(sessionCreated.destination)}</p>}<div className="share-link-box"><Link2 size={15} /><span>{baseUrl(sessionCreated.code)}</span><button className="icon-plain" onClick={() => void copySession(sessionCreated)} aria-label={t.copy}><Copy size={15} /></button></div><div className="modal-actions"><a className="secondary" target="_blank" rel="noreferrer" href={`/s/${sessionCreated.code}`}><ArrowUpRight size={14} />{t.preview}</a><button className="primary" onClick={() => setSessionModal(false)}>{t.done}</button></div></> : <><h2 className="modal-title" id="session-modal-title">{t.createSession}</h2><p className="modal-hint">{t.privacy}</p><form onSubmit={(event) => void createSession(event)}><label className="form-label" htmlFor="session-name">{t.name}</label><input className="form-input" id="session-name" name="name" required maxLength={100} placeholder={t.nameHint} />
        <div className="form-two"><div><label className="form-label" htmlFor="session-locale">{t.language}</label><select className="form-input" name="locale" id="session-locale" defaultValue={locale}><option value="ar">العربية</option><option value="en">English</option><option value="zh">简体中文</option></select></div><div><label className="form-label" htmlFor="duration-days">{t.expiry}</label><select className="form-input" name="durationDays" id="duration-days" defaultValue="7"><option value="1">{t.oneDay}</option><option value="7">{t.sevenDays}</option><option value="30">{t.thirtyDays}</option><option value="0">{t.never}</option></select></div></div>
        <label className="form-label" htmlFor="session-purpose">{t.purpose}</label><textarea className="form-input form-textarea" id="session-purpose" name="purpose" maxLength={240} placeholder={t.purposeHint} />
        <label className="form-label" htmlFor="session-destination">{t.destination}</label><input className="form-input" id="session-destination" name="destination" type="url" maxLength={2048} placeholder="https://www.tiktok.com/@creator/video/…" aria-describedby="session-destination-hint" /><p className="form-hint" id="session-destination-hint">{t.destinationHint}</p>
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
  return <table><thead><tr><th>{t.name}</th><th>{t.status}</th><th>{t.createdAt}</th><th>{t.views}</th><th>{t.media}</th><th>{t.actions}</th></tr></thead><tbody>{sessions.map((s) => { const state = sessionState(s); return <tr key={s.id}><td className="session-first-cell"><div className="link-cell"><div className="link-icon"><Camera size={14} /></div><div><div className="link-title">{s.name}</div><div className="link-sub">/s/{s.code}</div>{s.destination && <div className="link-sub" title={s.destination}>{destinationHost(s.destination)}</div>}</div></div></td><td><span className={`pill ${state !== "active" ? "inactive" : ""} ${state === "expired" ? "status-amber" : ""}`}>{t[state]}</span></td><td>{new Intl.DateTimeFormat(dateLocale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(s.createdAt))}</td><td>{s.views.toLocaleString(locale === "ar" ? "ar-SA" : locale === "zh" ? "zh-CN" : "en-US")}</td><td><span className="media-count"><ImageIcon size={12} /> {s.photoCount}</span></td><td><div className="row-actions"><button className="icon-plain" title={t.copy} aria-label={t.copy} onClick={() => onCopy(s)}><Copy size={14} /></button><a className="icon-plain" href={`/s/${s.code}`} target="_blank" rel="noreferrer" aria-label={t.preview} title={t.preview}><ArrowUpRight size={14} /></a>{!compact && <><button className="icon-plain" onClick={() => onToggle(s)} disabled={state === "expired" && s.active} title={s.active ? t.revoke : t.restore} aria-label={s.active ? t.revoke : t.restore}><Activity size={14} /></button><button className="icon-plain danger-icon" onClick={() => onDelete(s)} disabled={deleting === s.id} aria-label={t.delete} title={t.delete}><Trash2 size={14} /></button></>}</div></td></tr>; })}</tbody></table>;
}

function EmptyState({ title, hint, action, onClick }: { title: string; hint: string; action?: string; onClick?: () => void }) {
  return <div className="empty frame-empty"><div className="empty-icon"><ImageIcon size={19} /></div><strong>{title}</strong><p>{hint}</p>{action && onClick && <button className="primary empty-action" onClick={onClick}><Plus size={14} />{action}</button>}</div>;
}

function SkeletonRows() {
  return <div className="skeleton-list" aria-label="Loading sessions">{Array.from({ length: 3 }, (_, index) => <div className="skeleton-row" key={index}><span /><span /><span /><span /></div>)}</div>;
}

function MediaLibrary({ photos, locale, deleting, onDelete, t }: { photos: PhotoRecord[]; locale: Locale; deleting: string; onDelete: (p: PhotoRecord) => void; t: FrameFlowCopy }) {
  if (!photos.length) return <EmptyState title={t.noPhotos} hint={t.privacy} />;
  return <section><div className="section-top"><div><h2 className="section-title">{t.capturedPhotos}</h2><p className="section-hint">{t.private}</p></div><span className="pill">{photos.length} {t.photo}</span></div><div className="media-grid">{photos.map((photo) => <article className="media-card" key={photo.id}><div className="media-thumb"><img src={`/api/photos/${photo.id}`} alt={`${t.photo} · ${photo.sessionName || "FrameFlow"}`} loading="lazy" /></div><div className="media-card-copy"><strong>{photo.sessionName || t.brand}</strong><span>{new Date(photo.createdAt).toLocaleDateString(locale === "ar" ? "ar-SA" : locale === "zh" ? "zh-CN" : "en-US")} · {(photo.size / 1024).toFixed(0)} KB</span><button className="icon-plain danger-icon" onClick={() => onDelete(photo)} disabled={deleting === photo.id} aria-label={t.deletePhoto}><Trash2 size={14} />{t.deletePhoto}</button></div></article>)}</div></section>;
}

function SettingsPanel({ locale, onLocale, theme, onThemeChange, t }: { locale: Locale; onLocale: (locale: Locale) => void; theme: "dark" | "light"; onThemeChange: (theme: "dark" | "light") => void; t: FrameFlowCopy }) {
  return <section className="settings-grid"><div className="privacy-panel settings-card"><span className="stat-icon"><ShieldCheck size={17} /></span><h2 className="section-title">{t.settingsTitle}</h2><p>{t.settingCopy}</p><p>{t.cameraDisclosure}</p></div><div className="privacy-panel settings-card"><span className="stat-icon"><Settings2 size={17} /></span><h2 className="section-title">{t.languageTitle}</h2><p>{t.languageHint}</p><LanguageMenu locale={locale} onChange={onLocale} /></div><div className="privacy-panel settings-card appearance-card"><span className="stat-icon">{theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}</span><h2 className="section-title">{t.themeTitle}</h2><p>{t.themeHint}</p><div className="theme-options" role="group" aria-label={t.themeTitle}><button type="button" className={`theme-option ${theme === "light" ? "selected" : ""}`} aria-pressed={theme === "light"} onClick={() => onThemeChange("light")}><Sun size={15} />{t.lightMode}</button><button type="button" className={`theme-option ${theme === "dark" ? "selected" : ""}`} aria-pressed={theme === "dark"} onClick={() => onThemeChange("dark")}><Moon size={15} />{t.darkMode}</button></div></div></section>;
}
