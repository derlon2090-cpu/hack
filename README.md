# FrameFlow Studio

FrameFlow Studio is a private, single-admin creative workspace for consent-based camera sessions, private photo management, and real MP4 generation. Its dashboard and visitor flows support English, Arabic (RTL), and Simplified Chinese.

## Stack

- Next.js App Router, React, TypeScript (`strict`), and Tailwind CSS
- PostgreSQL with Drizzle ORM and versioned SQL migrations (connects to Supabase PostgreSQL or another PostgreSQL server)
- A single shared access code, verified on the server using bcrypt; signed `HttpOnly`, `SameSite=Strict`, `Secure` production cookies and a WebCrypto-verified middleware session
- Private S3-compatible object storage
- FFmpeg on the server to produce actual H.264 MP4 files from user-confirmed JPEG, PNG, or WebP images
- Zod validation and Vitest unit tests

This initial private workspace uses the shared-access-code option, not Supabase Auth. Public user registration is not implemented. Sessions, captures, and videos are restricted to the configured FrameFlow administrator in the server API. Use Supabase Auth with per-user ownership and appropriate database RLS before turning this into a multi-user service.

## Local setup

Requirements: Node.js 20.9+, PostgreSQL 14+, FFmpeg with the `libx264` encoder, and a private S3-compatible bucket if you want to upload captures and videos.

1. Install packages: `npm install`
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL` to your FrameFlow PostgreSQL database and set `NEXT_PUBLIC_APP_URL` to the site origin.
4. Generate a random `AUTH_SECRET` with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
5. Pick a strong access code, then generate its bcrypt hash: `node -e "require('bcryptjs').hash('replace-this-with-your-code',12).then(console.log)"`. Put the resulting hash in `ACCESS_CODE_HASH`; never put the code itself in a source file or a `NEXT_PUBLIC_` variable.
6. Apply migrations: `npm run db:migrate`.
7. Configure `S3_BUCKET`, credentials, region, endpoint, and path-style mode for a **private** bucket.
8. Ensure the FFmpeg binary is on `PATH`, or set `FFMPEG_PATH` to its path. Set `FFMPEG_FONT_FILE` if captions should be burned into videos; use a font file that supports the languages you expect to caption.
9. Start locally with `npm run dev`, then visit `http://localhost:3000/login`.

`NEXT_PUBLIC_APP_URL` should be the public HTTPS origin in production. Camera access requires HTTPS in production (localhost works for local development). Never enable public bucket access or object ACLs.

## Migrations

`drizzle/0000_initial.sql` creates the original link tables. `drizzle/0001_frameflow_sessions.sql` adds FrameFlow sessions and MP4 records and keeps existing link, consent, and photo rows intact. `drizzle/0002_session_destination.sql` adds the optional TikTok video destination to sessions. `npm run db:migrate` applies unapplied numbered SQL files in order and records them in `schema_migrations`; run it as a release step before deploying code that uses a new migration.

New session rows use a single `owner_id` administrator scope; management APIs filter by that scope. PostgreSQL is only reachable from the server. No database or object-storage credentials are bundled in the frontend. For a multi-user/Supabase Auth deployment, add per-user `owner_id` values, enforce Row Level Security, and replace the shared administrator session with verified Supabase sessions before deployment.

## Sessions and consent

- Create a named session, choose its language, an optional purpose and official TikTok video URL, an expiry (1, 7, or 30 days, or no expiry), and a file retention period. The visitor sees the TikTok destination; after explicitly confirming a photo upload, the page redirects there after one second. Visitors who decline can choose whether to continue to that destination.
- Share `/s/[code]`; new codes are cryptographically random, 11-character alphanumeric slugs that omit visually ambiguous characters. A session can be cancelled, reactivated before its expiry, or permanently deleted along with its private media and derived videos.
- The public page explains the purpose and retention period. Camera permission is requested only after visitor consent and a separate camera-button action. The browser then displays its own permission prompt and live preview.
- The visitor chooses when to capture, can retake/cancel, and must separately confirm upload. There is no background capture or upload. Declining records a denial and does not request camera access.
- Sessions and media endpoints validate the current server session. Share URLs are random bearer tokens with a selectable 1-, 7-, or 30-day expiry; deleting the MP4 revokes its share URL.

Uploads are limited to 5 MB and checked against their JPEG/PNG/WebP file signature. S3 objects are private and encrypted server-side. Administrators stream images and videos through authenticated, `no-store` API routes; private object URLs are never exposed. Public video-share routes serve only a live, unexpired share token.

## MP4 rendering

Video Studio sends a selected, consented image, a 3/5/10-second duration, background color, and optional caption to an authenticated route. The server writes a temporary input, invokes FFmpeg without a shell, verifies that the output is a real MP4 (`ftyp`), stores it privately, and only then records success. The temporary working directory is removed after processing. If FFmpeg, `libx264`, or a configured caption font is unavailable, the request fails clearly instead of displaying a false success state.

Install FFmpeg with `libx264` enabled on the application host. The text overlay is optional; to use it, configure `FFMPEG_FONT_FILE`. Provide fonts with the required Arabic/CJK glyphs. Rendering is CPU-intensive and limited to five requests per minute per client in the app process; enforce an additional shared rate limit at the production edge when running multiple server instances.

## File retention

Each session can set 7, 30, 90, 180, or 365-day retention. Schedule `npm run photos:purge` daily as a protected job. It removes expired private image and video objects as well as their database records. Legacy images that are not attached to a FrameFlow session use `PHOTO_RETENTION_DAYS` (default 30). Administrators can also permanently delete individual photos, videos, or whole sessions; deleting a source image also removes MP4s made from it and revokes their share links.

## Main routes

- `/login` — access-code entry with show/hide control, loading/error states, and translated UI.
- `/` — protected dashboard, real PostgreSQL statistics, session search/status filters, media library, Video Studio, and settings.
- `/s/[code]` — public, expiry-checked camera-consent session.
- `/v/[token]` — public MP4 playback/download using a time-limited share token.
- `/api/sessions`, `/api/sessions/[code]` — protected session CRUD; the explicit public and consent subroutes provide the minimum visitor capabilities.
- `/api/photos` and `/api/photos/[id]` — consent-bound upload and protected image access/deletion.
- `/api/videos`, `/api/videos/[id]` — real MP4 processing, protected playback/download, expiring share token creation, and deletion.

The Next.js middleware verifies the signed session for dashboard pages and protected APIs. Protected route handlers also verify their session so API authorization does not depend on UI visibility alone. Login attempts have per-process rate limits and an increasing delay following failures. For a clustered deployment, configure distributed rate limiting at your trusted reverse proxy/WAF.

## Checks

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npx playwright install chromium` (first run only)
- `npm run test:e2e`
- `npm run build`

Vitest covers access-session signatures, camera/upload gates, media signatures, session/share expiry, destination validation, input validation, and FFmpeg configuration. Playwright covers login protection, access-code handling, session creation, decline-without-camera, and a fake-device capture where upload remains blocked until confirmation. Browser tests mock the API and do not replace staging integration tests. Real browser permission behavior depends on the device and HTTPS origin; database migration/authorization, S3 upload/deletion, and FFmpeg output should also be exercised on a staging database, private test bucket, and the same FFmpeg build as production before launch.

## Production checklist

Set strong server-only secrets; provision TLS, PostgreSQL and a private S3 bucket; apply migrations as a release step; install and test FFmpeg; configure a production font only if captions are enabled; set the correct `NEXT_PUBLIC_APP_URL`; schedule the retention job; and configure distributed rate limiting. The shared access code is intended for one private administrator, not as an account system for public visitors.
