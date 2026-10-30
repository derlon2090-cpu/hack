const STORAGE_KEY = "link-studio-device-code";
const COOKIE_NAME = "link_studio_device_code";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createCode() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A random first-party browser token, created only after the visitor chooses to proceed. */
export function getOrCreateDeviceCode() {
  if (typeof window === "undefined") return "";
  let code = "";
  try { code = localStorage.getItem(STORAGE_KEY) || ""; } catch { /* Storage can be disabled in private browsers. */ }
  if (!UUID_PATTERN.test(code)) {
    const cookie = document.cookie.split("; ").find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1) || "";
    code = UUID_PATTERN.test(cookie) ? cookie : createCode();
  }
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* Cookie remains as the fallback. */ }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  try { document.cookie = `${COOKIE_NAME}=${code}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`; } catch { /* Keep this session's code in memory/local storage when possible. */ }
  return code;
}
