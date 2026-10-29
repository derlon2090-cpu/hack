const TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]);
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

/** Accept only official, HTTPS TikTok video/share URLs for session destinations. */
export function isTikTokVideoDestination(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  if (url.protocol !== "https:" || url.port || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (!TIKTOK_HOSTS.has(host)) return false;
  if (host === "vt.tiktok.com" || host === "vm.tiktok.com") return /^\/[A-Za-z0-9_-]{5,40}\/?$/.test(url.pathname);
  return /^\/@[A-Za-z0-9._-]{1,50}\/video\/\d{8,25}\/?$/.test(url.pathname)
    || /^\/t\/[A-Za-z0-9_-]{5,40}\/?$/.test(url.pathname);
}

/** Validate platform video URLs while returning no rewritten URL. Non-video public destinations remain supported. */
export function isSupportedDestination(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  const host = url.hostname.toLowerCase();
  if (TIKTOK_HOSTS.has(host)) return url.protocol === "https:" && !url.port && url.pathname.length > 1;
  if (host === "youtu.be") return url.protocol === "https:" && !url.port && VIDEO_ID.test(url.pathname.slice(1));
  if (!YOUTUBE_HOSTS.has(host)) return true;
  if (url.protocol !== "https:" || url.port) return false;
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.pathname === "/watch") return VIDEO_ID.test(url.searchParams.get("v") || "");
  return parts.length === 2 && ["shorts", "live", "embed"].includes(parts[0]) && VIDEO_ID.test(parts[1]);
}
