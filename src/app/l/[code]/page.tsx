"use client";
/* eslint @next/next/no-img-element: "off" */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link2, ShieldCheck } from "lucide-react";
import { Toaster, toast } from "sonner";
import Link from "next/link";
import { LanguageMenu } from "@/components/language-menu";
import { messages, type Locale, localeDir } from "@/lib/i18n";
import { isSupportedDestination } from "@/lib/destinations";
import { getOrCreateDeviceCode } from "@/lib/device-code";

type LinkDetails = { code: string; name: string; destination: string; locale: Locale };
type Phase = "loading" | "consent" | "camera" | "done" | "unavailable";
const purpose = { en: "Capture a portrait for this campaign", ar: "التقاط صورة شخصية لهذه الحملة", zh: "为此活动拍摄一张人像照片" };
const domain = (value: string) => { try { return new URL(value).host.replace(/^www\./i, ""); } catch { return value; } };
const fullDestination = (value: string) => { try { return new URL(value).href; } catch { return value; } };

export default function SharedLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const [code, setCode] = useState("");
  const [link, setLink] = useState<LinkDetails | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [phase, setPhase] = useState<Phase>("loading");
  const [cameraError, setCameraError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoSaved, setPhotoSaved] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visitedRef = useRef(false);
  const t = messages[locale];
  const flowCopy = locale === "ar" ? {
    consent: "بالضغط على الموافقة سيطلب المتصفح إذن الكاميرا. إذا سمحت، ستُلتقط صورة واحدة وتُرفع بشكل خاص ثم يُفتح فيديو تيك توك. إذا رفضت إذن الكاميرا، ستنتقل إلى الفيديو دون حفظ صورة. سنحفظ رمزًا عشوائيًا لهذا المتصفح لتمييز تكرار الزيارة؛ لا نستخدم بصمة الجهاز أو موقعه.",
    approve: "أوافق، التقط الصورة وافتح تيك توك",
    working: "بانتظار إذن الكاميرا…",
    capture: "جارٍ التقاط الصورة ورفعها بشكل خاص…",
    saved: "تم حفظ الصورة. جارٍ فتح فيديو تيك توك…",
    continue: "المتابعة إلى فيديو تيك توك",
    retry: "إعادة المحاولة"
  } : locale === "zh" ? {
    consent: "点击同意后，浏览器会请求摄像头权限。允许后将拍摄一张照片并私密上传，然后打开 TikTok 视频。若拒绝摄像头权限，将直接前往视频且不会保存照片。我们会保存一个随机浏览器识别码以识别重复访问，不使用设备指纹或位置。",
    approve: "同意拍摄并打开 TikTok",
    working: "等待摄像头权限…",
    capture: "正在拍摄并私密上传照片…",
    saved: "照片已保存，正在打开 TikTok 视频…",
    continue: "前往 TikTok 视频",
    retry: "重试"
  } : {
    consent: "When you agree, your browser will ask for camera access. If you allow it, one photo will be taken and uploaded privately, then the TikTok video will open. If you deny camera access, you will go to the video without a photo being saved. We save a random browser code to recognize repeat visits; we do not use device fingerprinting or location.",
    approve: "Agree, take photo & open TikTok",
    working: "Waiting for camera permission…",
    capture: "Taking and privately uploading your photo…",
    saved: "Photo saved. Opening the TikTok video…",
    continue: "Continue to TikTok video",
    retry: "Try again"
  };

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    params.then((result) => {
      if (!active) return;
      setCode(result.code);
      fetch(`/api/resolve/${encodeURIComponent(result.code)}`, { cache: "no-store" }).then(async (response) => {
        if (!active) return;
        if (!response.ok) { setPhase("unavailable"); return; }
        const found = await response.json() as LinkDetails;
        if (!active) return;
        setLink(found);
        const preferred = new URLSearchParams(window.location.search).get("lang");
        const stored = localStorage.getItem("link-studio-locale");
        const selected = ([preferred, stored, found.locale].find((value) => value === "en" || value === "ar" || value === "zh") || "en") as Locale;
        setLocale(selected);
        setPhase("consent");
        if (!visitedRef.current && !sessionStorage.getItem(`ls-visit-${result.code}`)) {
          visitedRef.current = true; sessionStorage.setItem(`ls-visit-${result.code}`, "1");
          void fetch(`/api/links/${encodeURIComponent(result.code)}`, { method: "POST" });
        }
      }).catch(() => { if (active) setPhase("unavailable"); });
    });
    return () => { active = false; stopCamera(); };
  }, [params, stopCamera]);

  useEffect(() => {
    if (!photoSaved || phase !== "done" || !link) return;
    const timeout = window.setTimeout(() => {
      if (isSupportedDestination(link.destination)) {
        window.location.assign(new URL(link.destination).href);
      }
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [photoSaved, phase, link]);

  async function recordDecision(decision: "granted" | "denied", deviceCode?: string) {
    if (!code) return "";
    try {
      const response = await fetch(`/api/links/${encodeURIComponent(code)}/consent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose: purpose[locale], decision, locale, deviceCode }), keepalive: decision === "denied" });
      if (!response.ok) throw new Error("Unable to save your choice.");
      const data = await response.json() as { id: string };
      return data.id;
    } catch { return ""; }
  }

  async function agree() {
    if (saving) return;
    setCameraError("");
    setPhase("camera");
    const deviceCode = getOrCreateDeviceCode();
    if (!navigator.mediaDevices?.getUserMedia) {
      void recordDecision("denied", deviceCode);
      continueToDestination();
      return;
    }

    // Request permission synchronously from the consent button's user gesture.
    setSaving(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 1280, max: 1920 }, height: { ideal: 960, max: 1440 } } });
      const id = await recordDecision("granted", deviceCode);
      if (!id) { stream.getTracks().forEach((track) => track.stop()); continueToDestination(); return; }
      streamRef.current = stream;
      setUploadingPhoto(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const video = videoRef.current; const canvas = canvasRef.current;
      if (!video || !canvas) throw new Error("Camera capture is unavailable.");
      video.srcObject = stream;
      await video.play();
      if (!video.videoWidth) await new Promise<void>((resolve, reject) => {
        video.addEventListener("loadedmetadata", () => resolve(), { once: true });
        window.setTimeout(() => reject(new Error("Camera did not become ready.")), 5000);
      });
      const ratio = Math.min(1, 1280 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * ratio); canvas.height = Math.round(video.videoHeight * ratio);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to prepare photo.");
      context.setTransform(-1, 0, 0, 1, canvas.width, 0); context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", 0.84);
      stopCamera();
      setUploadingPhoto(true);
      const response = await fetch("/api/photos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consentId: id, explicitConfirmation: true, mimeType: "image/jpeg", data }) });
      if (!response.ok) throw new Error("Photo upload failed.");
      setPhotoSaved(true); setPhase("done"); toast.success(t.photoSaved);
    } catch (err) {
      stopCamera();
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError" || name === "NotFoundError" || name === "OverconstrainedError") {
        void recordDecision("denied", deviceCode);
        continueToDestination();
      } else setCameraError(t.uploadError);
    } finally { setSaving(false); setUploadingPhoto(false); }
  }

  async function decline() {
    void recordDecision("denied");
    continueToDestination();
  }

  function continueToDestination() {
    if (!link) return;
    if (!isSupportedDestination(link.destination)) { toast.error("This video URL needs to be a valid public YouTube or TikTok link."); return; }
    const destination = new URL(link.destination);
    window.location.assign(destination.href);
  }

  const isRTL = localeDir(locale) === "rtl";
  return <main className={`landing-shell public-capture-page ${isRTL ? "rtl" : ""}`}>
    <Toaster position="bottom-right" richColors />
    <nav className="landing-nav"><div className="brand"><span className="brand-mark"><Link2 size={16} /></span><span className="brand-name">{t.brand}</span></div><LanguageMenu locale={locale} onChange={setLocale} /></nav>
    <section className="landing-card">
      {phase === "loading" ? <div className="empty"><p>{t.loading}</p></div> : phase === "unavailable" ? <><div className="landing-badge"><ShieldCheck size={12} />{t.expired}</div><h1>{t.notFound}</h1><p className="landing-lead">{t.notFoundHint}</p><Link className="secondary" href="/">{t.returnHome}</Link></> : <>
        <div className="landing-badge"><ShieldCheck size={12} />{t.attribution}</div>
        <h1>{phase === "consent" ? t.consentTitle : phase === "camera" ? t.cameraTitle : t.redirect}</h1>
        <p className="landing-lead">{phase === "consent" ? t.consentLead : phase === "camera" ? (cameraError || (saving ? (uploadingPhoto ? flowCopy.capture : flowCopy.working) : t.cameraUnavailable)) : photoSaved ? t.photoSaved : t.consentLead}</p>
        {link && <div className="campaign-box"><div className="campaign-label">{t.campaign}</div><div className="campaign-name">{link.name}</div><div className="destination-box"><ExternalDomain domain={fullDestination(link.destination)} /></div></div>}
        {phase === "consent" && <>
          <div className="purpose-title">{t.purpose}</div><div className="purpose-box">{purpose[locale]}</div>
          <p className="landing-explain">{flowCopy.consent}</p><div className="landing-actions"><button className="primary" disabled={saving} onClick={() => void agree()}>{saving ? t.loading : flowCopy.approve}</button><button className="secondary" disabled={saving} onClick={() => void decline()}>{t.reject} · {flowCopy.continue}</button></div>
        </>}
        {phase === "camera" && <>
          <div className="camera-frame"><div className="camera-placeholder"><ShieldCheck size={27} /><p>{saving ? (uploadingPhoto ? flowCopy.capture : flowCopy.working) : cameraError}</p></div></div>
          <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden="true" />
          <video ref={videoRef} autoPlay playsInline muted className="capture-source" aria-hidden="true" />
          {cameraError && <div className="error-note" role="alert">{cameraError}</div>}
          {!saving && cameraError && <div className="landing-actions"><button className="primary" onClick={() => void agree()}>{flowCopy.retry}</button><button className="secondary" onClick={continueToDestination}>{flowCopy.continue}</button></div>}
        </>}
        {phase === "done" && <>
          <p className="landing-explain">{photoSaved ? flowCopy.saved : t.consentExplain}</p>
          <button className="primary" style={{ width: "100%", minHeight: 44 }} onClick={continueToDestination}><span>{flowCopy.continue}</span><span style={{ fontWeight: 400, opacity: .82 }}> · {link ? domain(link.destination) : ""}</span></button>
        </>}
      </>}
    </section>
    <footer className="landing-bottom"><span>{t.footer}</span><span><ShieldCheck size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />{t.protected}</span></footer>
  </main>;
}

function ExternalDomain({ domain }: { domain: string }) {
  return <span><Link2 size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />{domain}</span>;
}
