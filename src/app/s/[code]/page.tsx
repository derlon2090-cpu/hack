"use client";
/* eslint @next/next/no-img-element: "off" */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Link2, ShieldCheck } from "lucide-react";
import { Toaster, toast } from "sonner";
import Link from "next/link";
import { LanguageMenu } from "@/components/language-menu";
import { messages, type Locale, localeDir } from "@/lib/i18n";
import { mayRequestCamera } from "@/lib/camera-consent";
import { isTikTokVideoDestination } from "@/lib/destinations";

type LinkDetails = { code: string; name: string; purpose: string | null; destination: string | null; locale: Locale; expiresAt: string | null; retentionDays: number };
type Phase = "loading" | "consent" | "camera" | "done" | "unavailable";
type CameraStatus = "idle" | "live" | "captured" | "denied" | "unavailable" | "unsupported";

const purpose = { en: "Capture a portrait for this campaign", ar: "التقاط صورة شخصية لهذه الحملة", zh: "为此活动拍摄一张人像照片" };

export default function SharedLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const [code, setCode] = useState("");
  const [link, setLink] = useState<LinkDetails | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [phase, setPhase] = useState<Phase>("loading");
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentId, setConsentId] = useState("");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraError, setCameraError] = useState("");
  const [photoData, setPhotoData] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoSaved, setPhotoSaved] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visitedRef = useRef(false);
  const t = messages[locale];

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    params.then((result) => {
      if (!active) return;
      setCode(result.code);
      fetch(`/api/sessions/${encodeURIComponent(result.code)}/public`, { cache: "no-store" }).then(async (response) => {
        if (!active) return;
        if (!response.ok) { setPhase("unavailable"); return; }
        const found = await response.json() as LinkDetails;
        if (!active) return;
        setLink(found);
        const preferred = new URLSearchParams(window.location.search).get("lang");
        const stored = localStorage.getItem("frameflow-locale");
        const selected = ([preferred, stored, found.locale].find((value) => value === "en" || value === "ar" || value === "zh") || "en") as Locale;
        setLocale(selected);
        setPhase("consent");
        if (!visitedRef.current && !sessionStorage.getItem(`ls-visit-${result.code}`)) {
          visitedRef.current = true; sessionStorage.setItem(`ls-visit-${result.code}`, "1");
          void fetch(`/api/sessions/${encodeURIComponent(result.code)}/public`, { method: "POST" });
        }
      }).catch(() => { if (active) setPhase("unavailable"); });
    });
    return () => { active = false; stopCamera(); };
  }, [params, stopCamera]);

  useEffect(() => {
    if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [cameraStatus]);

  useEffect(() => {
    if (!photoSaved || phase !== "done" || !link?.destination || !isTikTokVideoDestination(link.destination)) return;
    const timeout = window.setTimeout(() => window.location.assign(link.destination!), 1000);
    return () => window.clearTimeout(timeout);
  }, [photoSaved, phase, link]);

  async function recordDecision(decision: "granted" | "denied") {
    if (!code) return "";
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(code)}/consent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose: link?.purpose || purpose[locale], decision, locale }) });
      if (!response.ok) throw new Error("Unable to save your choice.");
      const data = await response.json() as { id: string };
      setConsentId(data.id);
      return data.id;
    } catch { toast.error("Your choice could not be recorded. Please try again."); return ""; }
  }

  async function agree() {
    if (!consentGiven) return;
    const id = await recordDecision("granted");
    if (id) setPhase("camera");
  }

  async function decline() {
    const id = await recordDecision("denied");
    if (id) setPhase("done");
  }

  async function startCamera() {
    if (!mayRequestCamera(Boolean(consentId), consentId, phase === "camera")) return;
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) { setCameraStatus("unsupported"); setCameraError(t.cameraUnsupported); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 1280, max: 1920 }, height: { ideal: 960, max: 1440 } } });
      streamRef.current = stream; setCameraStatus("live");
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") { setCameraStatus("denied"); setCameraError(t.cameraDenied); }
      else { setCameraStatus("unavailable"); setCameraError(t.cameraUnavailable); }
    }
  }

  function takePhoto() {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) { setCameraError(t.cameraUnavailable); return; }
    const ratio = Math.min(1, 1280 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * ratio); canvas.height = Math.round(video.videoHeight * ratio);
    const context = canvas.getContext("2d"); if (!context) return;
    context.translate(canvas.width, 0); context.scale(-1, 1); context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhotoData(canvas.toDataURL("image/jpeg", 0.84)); stopCamera(); setCameraStatus("captured");
  }

  async function confirmUpload() {
    if (!consentId || !photoData) return;
    setSaving(true); setCameraError("");
    try {
      const response = await fetch("/api/photos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consentId, explicitConfirmation: true, mimeType: "image/jpeg", data: photoData }) });
      if (!response.ok) throw new Error("upload");
      setPhotoData(""); setCameraStatus("idle"); setPhotoSaved(true); setPhase("done"); toast.success(t.photoSaved);
    } catch { setCameraError(t.uploadError); }
    finally { setSaving(false); }
  }

  function cancelCapture() {
    setPhotoData(""); setCameraStatus("idle"); stopCamera();
  }

  function continueToDestination() {
    if (link?.destination && isTikTokVideoDestination(link.destination)) window.location.assign(link.destination);
    else window.location.assign("/");
  }

  const isRTL = localeDir(locale) === "rtl";
  return <main className={`landing-shell ${isRTL ? "rtl" : ""}`}>
    <Toaster position={locale === "ar" ? "bottom-left" : "bottom-right"} richColors />
      <nav className="landing-nav"><div className="brand"><span className="brand-mark"><Link2 size={16} /></span><span className="brand-name">FrameFlow</span></div><LanguageMenu locale={locale} onChange={setLocale} /></nav>
    <section className="landing-card">
      {phase === "loading" ? <div className="empty"><p>{t.loading}</p></div> : phase === "unavailable" ? <><div className="landing-badge"><ShieldCheck size={12} />{t.expired}</div><h1>{t.notFound}</h1><p className="landing-lead">{t.notFoundHint}</p><Link className="secondary" href="/">{t.returnHome}</Link></> : <>
          <div className="landing-badge"><ShieldCheck size={12} />{locale === "ar" ? "تجربة FrameFlow Studio" : locale === "zh" ? "FrameFlow Studio 体验" : "A FrameFlow Studio experience"}</div>
        <h1>{phase === "consent" ? t.consentTitle : phase === "camera" ? t.cameraTitle : t.redirect}</h1>
        <p className="landing-lead">{phase === "consent" ? t.consentLead : phase === "camera" ? t.cameraHint : photoSaved && link?.destination ? t.redirectingToVideo : photoSaved ? t.photoSaved : t.consentLead}</p>
        {link && <div className="campaign-box"><div className="campaign-label">{t.campaign}</div><div className="campaign-name">{link.name}</div><div className="destination-box">{link.purpose || purpose[locale]}</div>{link.destination && isTikTokVideoDestination(link.destination) && <a className="form-hint destination-preview" href={link.destination} target="_blank" rel="noreferrer">{t.videoDestination}: {link.destination} <span aria-hidden="true">↗</span></a>}<div className="form-hint">{locale === "ar" ? `تُحذف الملفات بعد ${link.retentionDays} يومًا.` : locale === "zh" ? `文件将在 ${link.retentionDays} 天后删除。` : `Files are deleted after ${link.retentionDays} days.`}</div>{link.expiresAt && <div className="form-hint">{locale === "ar" ? "تنتهي الجلسة: " : locale === "zh" ? "会话到期：" : "Session expires: "}{new Date(link.expiresAt).toLocaleString(locale === "zh" ? "zh-CN" : locale === "ar" ? "ar-SA" : "en-US")}</div>}</div>}
        {phase === "consent" && <>
          <div className="purpose-title">{t.purpose}</div><div className="purpose-box">{purpose[locale]}</div>
          <label className="purpose-check"><input type="checkbox" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)} /><span>{t.consent}</span></label>
          <p className="landing-explain">{t.consentExplain}</p><div className="landing-actions"><button className="primary" disabled={!consentGiven} onClick={() => void agree()}>{t.agree}</button><button className="secondary" onClick={() => void decline()}>{t.reject}</button><button className="subtle" onClick={() => void decline()}>{t.noCamera}</button></div>
        </>}
        {phase === "camera" && <>
          <div className="camera-frame">
            {cameraStatus === "live" && <video ref={videoRef} autoPlay playsInline muted className="mirrored" aria-label="Live camera preview" />}
            {cameraStatus === "captured" && <img src={photoData} alt="Preview of your photo before confirmation" />}
            {(cameraStatus === "idle" || cameraStatus === "denied" || cameraStatus === "unavailable" || cameraStatus === "unsupported") && <div className="camera-placeholder"><Camera size={27} /><p>{t.cameraHint}</p></div>}
          </div>
          <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden="true" />
          <p className="landing-explain">{t.privacyNote}</p>
          {cameraError && <div className="error-note" role="alert">{cameraError}</div>}
          <div className="camera-controls">
            {cameraStatus === "live" && <button className="primary" onClick={takePhoto}><Camera size={14} />{t.takePhoto}</button>}
            {cameraStatus === "captured" && <><button className="secondary" onClick={cancelCapture}>{t.cancelPhoto}</button><button className="secondary" onClick={() => { setPhotoData(""); setCameraStatus("idle"); void startCamera(); }}>{t.retake}</button><button className="primary" disabled={saving} onClick={() => void confirmUpload()}><Check size={14} />{saving ? t.loading : t.confirmUpload}</button></>}
            {cameraStatus !== "live" && cameraStatus !== "captured" && <><button className="primary" onClick={() => void startCamera()}><Camera size={14} />{t.allowCamera}</button><button className="secondary" onClick={() => { stopCamera(); setPhase("done"); }}>{t.noCamera}</button></>}
          </div>
        </>}
        {phase === "done" && <>
          {consentId && <div className="success-note"><Check size={13} style={{ verticalAlign: "middle", marginRight: 6 }} />{t.privacyNote}</div>}
          <p className="landing-explain">{t.consentExplain}</p>
          <button className="primary" style={{ width: "100%", minHeight: 44 }} onClick={continueToDestination}>{link?.destination ? t.continueToVideo : locale === "ar" ? "إنهاء" : locale === "zh" ? "完成" : "Finish"}</button>
        </>}
      </>}
    </section>
    <footer className="landing-bottom"><span>{t.footer}</span><span><ShieldCheck size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />{t.protected}</span></footer>
  </main>;
}

