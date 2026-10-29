# FrameFlow Studio

FrameFlow Studio is a private, single-admin workspace for consent-based photo sessions and private image management. The dashboard and visitor flows support English, Arabic (RTL), and Simplified Chinese.

## Stack

- Next.js App Router, React, TypeScript (`strict`), and Tailwind CSS
- PostgreSQL with Drizzle ORM and versioned SQL migrations
- Server-verified shared access code with signed `HttpOnly` session cookies
- Private S3-compatible object storage for confirmed photo uploads
- Zod validation and Vitest unit tests

This workspace is designed for one administrator. Public registration is not implemented. Session, capture, and management APIs are restricted to the configured administrator.

## Local setup

Requirements: Node.js 20.9+, PostgreSQL 14+, and a private S3-compatible bucket for photo uploads.

1. Install packages: `npm install`
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL` and `NEXT_PUBLIC_APP_URL`.
4. Generate an `AUTH_SECRET`: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
5. Generate a bcrypt access-code hash: `node -e "require('bcryptjs').hash('replace-this-with-your-code',12).then(console.log)"`. Set `ACCESS_CODE_HASH`; never store the plain code in source or a `NEXT_PUBLIC_` variable.
6. Apply migrations: `npm run db:migrate`.
7. Configure S3 credentials, region, endpoint, and path-style mode for a **private** bucket.
8. Start with `npm run dev` and visit `http://localhost:3000/login`.

Camera access requires HTTPS in production. Never enable public bucket access or object ACLs.

## Database migrations

`drizzle/0000_initial.sql` creates the original link tables. `drizzle/0001_frameflow_sessions.sql` adds sessions and media records while preserving existing rows. `drizzle/0002_session_destination.sql` adds an optional official TikTok destination. The numbered migration runner applies unapplied SQL files in order; run it as a release step before deploying code that depends on a migration. Legacy video records and files are preserved; the dashboard is photo-only.

## Photo sessions and consent

- Create a named session, choose its language, an optional purpose and official TikTok video destination, expiry, and photo retention period.
- Share `/s/[code]`; codes are cryptographically random. Sessions can be cancelled, reactivated before expiry, or deleted with their private media.
- The public page explains the photo purpose and retention period. Camera access starts only after visitor consent, a separate camera action, and the browser's permission.
- Visitors preview and may retake or cancel. Upload occurs only after explicit confirmation. Declining never requests camera access.
- TikTok destinations use official HTTPS links. They remain visible to visitors; after confirmed photo storage the visitor may continue to the selected destination.

Photo uploads are limited to 5 MB and validated by JPEG/PNG/WebP file signatures. S3 objects remain private. Administrators access and delete photos through authenticated, no-store API routes; object URLs are not exposed publicly.

## Retention and privacy

Sessions support configurable retention. Schedule `npm run photos:purge` daily as a protected job. It removes expired private media and database records. Administrators can permanently delete individual photos or entire sessions. Keep TLS enabled, use server-only secrets, and configure distributed rate limiting at the production edge when running multiple instances.

## Main routes

- `/login` — protected administrator access-code entry.
- `/` — protected photo-only dashboard, session management, image library, and settings.
- `/s/[code]` — public, expiry-checked consent and camera session.
- `/api/sessions` and `/api/sessions/[code]` — protected session management plus explicit public/consent subroutes.
- `/api/photos` and `/api/photos/[id]` — consent-bound photo upload and protected image access/deletion.

Legacy video API routes remain isolated for compatibility with existing records and are not linked from the photo dashboard.

## Checks

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npm run test:e2e`
- `npm run build`

Vitest covers authentication, consent and upload gates, media validation, expiry, destination validation, and inputs. Playwright covers dashboard protection, session creation, decline-without-camera, and capture confirmation. Browser permission behavior depends on the device and HTTPS origin; validate database authorization and private S3 behavior in staging before production.
