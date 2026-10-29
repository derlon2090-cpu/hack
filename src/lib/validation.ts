import { z } from "zod";
import { isIP } from "node:net";

const safeDestination = (raw: string) => {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (isIP(host) > 0 || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
    if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    return true;
  } catch { return false; }
};

export const linkInput = z.object({
  name: z.string().trim().min(1).max(100),
  destination: z.string().trim().url().max(2048).refine(safeDestination, "Use a public HTTP(S) destination without credentials."),
  locale: z.enum(["en", "ar", "zh"]).default("en")
});

export const consentInput = z.object({
  purpose: z.string().trim().min(1).max(180),
  decision: z.enum(["granted", "denied"]),
  locale: z.enum(["en", "ar", "zh"])
});

export const uploadInput = z.object({
  consentId: z.string().uuid(),
  explicitConfirmation: z.literal(true),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z.string().min(1).max(7 * 1024 * 1024)
});
