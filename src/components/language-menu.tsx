"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/i18n";

const names: Record<Locale, string> = { en: "EN", ar: "عربي", zh: "中文" };
export function LanguageMenu({ locale, onChange }: { locale: Locale; onChange: (locale: Locale) => void }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.body.classList.toggle("rtl", locale === "ar");
    localStorage.setItem("frameflow-locale", locale);
  }, [locale]);
  return <select aria-label="Language" className="language-select" value={locale} onChange={(e) => onChange(e.target.value as Locale)}>{(Object.keys(names) as Locale[]).map((key) => <option key={key} value={key}>{names[key]}</option>)}</select>;
}
