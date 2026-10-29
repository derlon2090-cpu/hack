"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Clapperboard, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Toaster, toast } from "sonner";
import { LanguageMenu } from "@/components/language-menu";
import { localeDir, type Locale } from "@/lib/i18n";

const copy: Record<Locale, { title: string; subtitle: string; field: string; show: string; hide: string; submit: string; loading: string; error: string; ready: string; badge: string; footer: string; tooMany: string; unavailable: string; network: string }> = {
  en: { title: "Welcome back", subtitle: "Enter your access code to continue to your workspace.", field: "Access code", show: "Show code", hide: "Hide code", submit: "Enter FrameFlow", loading: "Verifying…", error: "That access code is incorrect.", ready: "Welcome back to FrameFlow.", badge: "PRIVATE · SECURE", footer: "ENCRYPTED · PRIVATE", tooMany: "Too many attempts. Please wait and try again.", unavailable: "Sign-in is not configured on this server.", network: "Could not verify the access code. Check your connection and try again." },
  ar: { title: "مرحبًا بعودتك", subtitle: "أدخل رمز الوصول لمتابعة العمل في مساحة فريقك.", field: "رمز الوصول", show: "إظهار الرمز", hide: "إخفاء الرمز", submit: "الدخول إلى مساحة العمل", loading: "جارٍ التحقق…", error: "رمز الوصول غير صحيح.", ready: "مرحبًا بعودتك إلى FrameFlow.", badge: "مساحة خاصة · دخول آمن", footer: "اتصال مشفر · مساحة خاصة", tooMany: "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.", unavailable: "تسجيل الدخول غير مُعدّ على هذا الخادم.", network: "تعذّر التحقق من الرمز. تحقق من اتصالك ثم حاول مجددًا." },
  zh: { title: "欢迎回来", subtitle: "请输入访问码以继续进入工作区。", field: "访问码", show: "显示访问码", hide: "隐藏访问码", submit: "进入 FrameFlow", loading: "正在验证…", error: "访问码不正确。", ready: "欢迎回到 FrameFlow。", badge: "私密 · 安全", footer: "加密连接 · 私密空间", tooMany: "尝试次数过多，请稍后重试。", unavailable: "此服务器尚未配置登录。", network: "无法验证访问码，请检查网络后重试。" }
};

export default function LoginPage() {
  const [locale, setLocale] = useState<Locale>("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const t = copy[locale];

  useEffect(() => {
    const saved = localStorage.getItem("frameflow-locale") as Locale | null;
    if (saved && saved in copy) setLocale(saved);
    fetch("/api/auth/session", { cache: "no-store" }).then((r) => r.json()).then((data: { authenticated: boolean }) => { if (data.authenticated) window.location.replace("/"); }).catch(() => {});
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: data.get("code") }) });
      if (!response.ok) {
        setError(response.status === 429 ? t.tooMany : response.status === 503 ? t.unavailable : t.error);
        return;
      }
      toast.success(t.ready);
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch { setError(t.network); }
    finally { setBusy(false); }
  }

  return <main className={`login-page frame-login ${localeDir(locale) === "rtl" ? "rtl" : ""}`}>
    <Toaster position={locale === "ar" ? "bottom-left" : "bottom-right"} richColors />
    <div className="frame-login-language"><LanguageMenu locale={locale} onChange={setLocale} /></div>
    <div className="frame-login-layout">
      <header className="frame-login-hero">
        <div className="frame-login-badge"><ShieldCheck size={14} /><span>{t.badge}</span></div>
        <div className="frame-login-brand"><span className="frame-logo-icon"><Clapperboard size={19} /></span><span>FrameFlow <span className="brand-light">Studio</span></span></div>
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
      </header>
      <section className="login-card frame-login-card">
        <form onSubmit={(e) => void submit(e)}>
          <label className="form-label" htmlFor="access-code">{t.field}</label>
          <div className="secret-field"><input className="form-input" id="access-code" name="code" type={visible ? "text" : "password"} autoComplete="current-password" required maxLength={512} /><button type="button" className="secret-toggle" onClick={() => setVisible((value) => !value)} aria-label={visible ? t.hide : t.show} title={visible ? t.hide : t.show}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary" type="submit" disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true" />{t.loading}</> : <>{t.submit}<ArrowRight size={16} className="frame-login-arrow" /></>}</button>
        </form>
        <div className="frame-login-foot"><span><ShieldCheck size={13} />{t.footer}</span></div>
      </section>
    </div>
  </main>;
}
