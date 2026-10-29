"use client";
/* eslint @next/next/no-img-element: "off" */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Toaster, toast } from "sonner";
import Link from "next/link";
import { messages, type Locale } from "@/lib/i18n";
import { isTikTokVideoDestination } from "@/lib/destinations";

type LinkDetails = { code: string; name: string; purpose: string | null; destination: string | null; locale: Locale; expiresAt: string | null; retentionDays: number };
type Phase = "loading" | "consent" | "camera" | "done" | "unavailable";
type CameraStatus = "idle" | "live" | "captured" | "denied" | "unavailable" | "unsupported";

const purpose = { en: "Capture a portrait for this campaign", ar: "التقاط صورة شخصية لهذه الحملة", zh: "为此活动拍摄一张人像照片" };

export default function SharedLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const [code, setCode] = useState("");
  const [link, setLink] = useState<LinkDetails | null>(null);
  const locale: Locale = "zh";
  const t = messages[locale];
  const [phase, setPhase] = useState<Phase>("loading");
  const [consentId, setConsentId] = useState("");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraError, setCameraError] = useState("");
  const [saving, setSaving] = useState(false);
  const [cameraPermissionPending, setCameraPermissionPending] = useState(false);
  const [photoSaved, setPhotoSaved] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visitedRef = useRef(false);
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
    } catch { toast.error("无法记录您的选择，请重试。"); return ""; }
  }

  async function agree(existingConsentId = "") {
    if (!existingConsentId) {
      // Start the native permission request directly from the user's consent gesture.
      if (!navigator.mediaDevices?.getUserMedia) { setPhase("camera"); setCameraStatus("unsupported"); setCameraError(t.cameraUnsupported); return; }
    }
    setCameraError(""); setPhase("camera"); setSaving(true); setCameraPermissionPending(true);
    const permission = navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 1280, max: 1920 }, height: { ideal: 960, max: 1440 } } }).then((stream) => ({ stream }), (error: unknown) => ({ error }))
      : Promise.resolve({ error: new Error("Camera unavailable") });
    try {
      const id = existingConsentId || await recordDecision("granted");
      if (!id) { const result = await permission; setCameraPermissionPending(false); if ("stream" in result) result.stream.getTracks().forEach((track) => track.stop()); setPhase("consent"); return; }
      setConsentId(id);
      const result = await permission;
      setCameraPermissionPending(false);
      if (!("stream" in result)) throw result.error;
      const stream = result.stream;
      streamRef.current = stream;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) throw new Error("Camera preview is unavailable.");
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
      context.translate(canvas.width, 0); context.scale(-1, 1); context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/jpeg", 0.84);
      stopCamera();
      const response = await fetch("/api/photos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consentId: id, explicitConfirmation: true, mimeType: "image/jpeg", data: imageData }) });
      if (!response.ok) throw new Error("upload");
      setPhotoSaved(true); setCameraStatus("idle"); setPhase("done"); toast.success(t.photoSaved);
    } catch (error) {
      setCameraPermissionPending(false);
      stopCamera();
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") { setCameraStatus("denied"); setCameraError(t.cameraDenied); }
      else if (name === "NotFoundError" || name === "OverconstrainedError") { setCameraStatus("unavailable"); setCameraError(t.cameraUnavailable); }
      else if (!navigator.mediaDevices?.getUserMedia) { setCameraStatus("unsupported"); setCameraError(t.cameraUnsupported); }
      else { setCameraStatus("unavailable"); setCameraError(t.uploadError); }
    } finally { setSaving(false); setCameraPermissionPending(false); }
  }

  async function decline() {
    const id = await recordDecision("denied");
    if (id) setPhase("done");
  }

  function continueToDestination() {
    if (link?.destination && isTikTokVideoDestination(link.destination)) window.location.assign(link.destination);
    else window.location.assign("/");
  }

  return <main className="landing-shell public-capture-page">
    <Toaster position="bottom-right" richColors />
    <section className="landing-card public-link-card">
      {phase === "loading" ? <p className="public-status">正在加载…</p> : phase === "unavailable" ? <>
        <div className="public-link-icon"><Link2 size={34} /></div>
        <h1>链接暂不可用</h1><p className="public-status">链接可能已过期或被停用。</p>
        <Link className="secondary" href="/">返回</Link>
      </> : phase === "consent" ? <>
        <div className="public-link-icon"><Link2 size={34} /></div>
        <p className="public-destination" dir="ltr">{link?.destination || "TikTok"}</p>
        <h1 className="public-link-heading">即将打开 TikTok 外部链接</h1>
        <div className="public-consent-copy" lang="zh">
          <p>点击同意后，浏览器会请求使用前置摄像头。授权后将立即拍摄一张照片，并私密上传给本活动管理员。</p>
          <p>照片保存期限为 {link?.retentionDays ?? 0} 天，不会公开。上传完成后将自动打开上方显示的 TikTok 链接。您也可以拒绝。</p>
        </div>
        <div className="public-link-actions">
          <button className="primary consent-primary" onClick={() => void agree()}>同意拍摄并上传，打开 TikTok</button>
          <button className="secondary" onClick={() => void decline()}>拒绝</button>
        </div>
      </> : phase === "camera" ? <>
        <h1 className="public-camera-status" aria-live="polite">{cameraError || (cameraPermissionPending ? "请在浏览器提示中允许摄像头访问。" : saving ? "正在拍摄并安全上传…" : "正在准备摄像头…")}</h1>
        <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden="true" />
        <video ref={videoRef} autoPlay playsInline muted className="capture-source" aria-hidden="true" />
        {cameraError && <div className="public-link-actions"><button className="primary consent-primary" disabled={saving} onClick={() => void agree(consentId)}>重试</button><button className="secondary" onClick={continueToDestination}>不使用摄像头，继续</button></div>}
      </> : <>
        <div className="public-link-icon"><Check size={34} /></div>
        <h1 className="public-link-heading">照片已安全上传</h1>
        <p className="public-status">正在打开 TikTok…</p>
        <button className="primary consent-primary" onClick={continueToDestination}>打开 TikTok</button>
      </>}
    </section>
  </main>;
}

