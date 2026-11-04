\
# Amman Kumar D. — portfolio + private content studio

A responsive React application with a public portfolio and `/admin` dashboard. Public data lives in Supabase Postgres; private file buckets use scoped Edge Functions; authentication and administrator authorization use Supabase Auth, a UUID allowlist, and Row Level Security (RLS).

> **Setup is required.** This archive is not connected to a Supabase project and includes no deployment credentials, resume, public email, LinkedIn/LeetCode URLs, certificates or achievements. Those are intentionally left blank. No service-role key belongs in browser code. Contact submissions go to the private admin inbox; outbound email notification is not configured.

## Stack

React 19 · Vite 8 · Tailwind CSS · Framer Motion · Lucide React · Supabase PostgreSQL/Auth/Storage/Realtime + Deno Edge Functions · Cloudflare Turnstile · Vercel or Netlify.

Requires Node.js 22.12+ and npm.

## Run locally

1. Copy the public-variable template: `cp .env.example .env.local`.
2. Install dependencies and run Vite: `npm install && npm run dev`.
3. Open the URL Vite prints (usually `http://localhost:5173`). Until configured, the page clearly shows that Supabase is unavailable; protected writes and contact submission do not pretend to succeed.
4. Run checks:

   ```sh
   npm test
   npx playwright install chromium
   npm run test:e2e
   npm run build
   ```

Playwright starts a `test`-mode build with empty Supabase settings. It covers public render/navigation, project preview, mobile layout, and the unconfigured admin gate. It does not impersonate a cloud user or prove hosted persistence.

## Supabase project setup

Create a Supabase project. From the repository root, install/use the Supabase CLI, log in, link your project, and apply the migration:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

On a fresh Supabase project, the migration is `supabase/migrations/202611040001_portfolio.sql`; alternatively run it once in SQL Editor. It creates tables, RLS policies, private file buckets, a starter profile and the three user-supplied project descriptions. It creates **no** invented certificates, achievements or resume.

### Provision your administrator

1. Create your account in Supabase Authentication with a strong password and verified email. Disable public sign-ups after creating it; the site has no public registration UI.
2. Copy the Auth user's UUID from the project dashboard.
3. As project owner, allowlist only that UUID in SQL Editor:

   ```sql
   insert into public.admin_users (user_id)
   values ('YOUR-AUTH-USER-UUID')
   on conflict (user_id) do nothing;
   ```

4. Visit `https://YOUR-SITE/admin` and sign in.

Do not grant the browser INSERT/UPDATE/DELETE on `admin_users`; never put a service-role key in a `VITE_*` variable. `/admin` is not secret by URL—the database policies and server-side Edge Function checks are the authorization boundary.

### Edge Functions, Turnstile, and secrets

The three functions set `verify_jwt = false` in `supabase/config.toml` because they validate requests themselves. `contact` verifies Turnstile; `upload-file` authenticates an administrator; `portfolio-file` signs currently published records and authenticates admin deletion.

Create a Cloudflare Turnstile widget for the exact site hostnames. Set function secrets from a trusted CLI session, then deploy:

```sh
supabase secrets set \
  ALLOWED_ORIGINS='http://localhost:5173,https://YOUR-SITE.example' \
  TURNSTILE_SECRET_KEY='YOUR_PRIVATE_TURNSTILE_SECRET' \
  RATE_LIMIT_SECRET="$(openssl rand -hex 32)"
supabase functions deploy contact
supabase functions deploy upload-file
supabase functions deploy portfolio-file
```

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions. For a self-hosted function runtime, configure them as server-only secrets. Keep the public frontend variables in `.env.local` or your hosting provider's environment settings:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
VITE_TURNSTILE_SITE_KEY=YOUR_PUBLIC_TURNSTILE_SITE_KEY
VITE_SITE_URL=https://YOUR-SITE.example
```

`ALLOWED_ORIGINS` is a comma-separated list of exact origins (scheme, hostname, optional port; no path or trailing slash). Include each trusted local/production/preview origin that needs the contact or file APIs, and configure Turnstile hostnames consistently.

### File and contact behavior

- Storage buckets `certificates`, `resumes`, and `project-images` are private. There are no browser `storage.objects` policies; all file operations go through Edge Functions.
- Uploads require an admin session, allowlisted bucket, size limit (5 MB project image; 8 MB certificate/resume), and matching PDF/PNG/JPEG/WebP magic bytes.
- A public file URL is signed only when a matching certificate/project is published or a resume record exists; links expire after **10 minutes**. Unpublishing prevents new links, but an already-issued link remains usable until it expires. Deleting the object invalidates it sooner. Only upload a resume/certificate you intend to make public.
- File replacement saves the new object and metadata before attempting to remove an old object. Failures are surfaced; the UI does not claim an unconfirmed deletion.
- Contact requires Turnstile + allowed origin and enforces five accepted submissions per normalized email per 15 minutes using a keyed hash (no raw IP is retained). This is not an IP-wide abuse limit. Contact messages go to the private dashboard inbox; no email notification is configured.
- Profile email and social links are public if you enter them. Only add details intended for publication.

## Deploy

**Vercel:** import the repository; use `npm run build` (or the included `vercel.json`). Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY`, and `VITE_SITE_URL` in environment settings, then redeploy.

**Netlify:** build command `npm run build`, publish directory `dist` (both in `netlify.toml`). Set the same public variables and redeploy. Keep Turnstile's hostnames and Supabase `ALLOWED_ORIGINS` synchronized.

The supplied deployment headers include an SPA fallback, CSP, anti-sniffing and referrer protections. If adding external sources or a new host, update the CSP and allowlists deliberately.

## Admin features

The public page reads published records from Supabase; Realtime refreshes content when configured. `/admin` provides overview; project CRUD; certificate CRUD, image/PDF uploads, search/category and verification-link data; certificate category management; achievement CRUD; resume replace/remove; profile and skill editing; social/contact fields; and private messages inbox. Supplied project repository links are prefilled. Certificates, awards, demos, credentials and personal links are not fabricated.

## Tests and release

- `npm test` — validation and static security regression checks.
- `npm run test:e2e` — Playwright Chromium smoke tests; install Chromium first.
- `npm run build` — production Vite build.
- `supabase test db` — optional pgTAP policy checks in a configured Supabase CLI project.
- After setting up a real project, complete [`qa/VERIFICATION.md`](qa/VERIFICATION.md) to check login, CRUD, signed previews/expiry, uploads, contact inbox and object deletion. This archive has not been connected to an owner's hosted backend.

## Update later

Ordinary content and uploads are managed in `/admin` and persist in Supabase without editing source. Add your real email/social links, resume, certificates and achievements as you are ready. Layout, code, security policy, or schema changes require source edits and a redeploy.
