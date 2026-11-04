\
# Verification and live acceptance checklist

## Executed offline in this build session

- Parsed and compiled all 13 JavaScript, JSX and TypeScript modules in the component assembly.
- Ran Chromium against the generated site: **19/19 offline UI checks passed**. These covered public render and runtime errors, navigation targets, supplied GitHub links, project modal open/close, unavailable-backend states, 390/768/1024 px overflow, mobile nav, `/admin` deep links and protected login, noindex, and 404.
- Ran the project’s Node validation/security suite directly with Node 26 (`node --test tests/*.test.mjs`): **7/7 tests passed**, including contact/file validation, browser-safe URL checks, storage-policy/signed-link invariants, HMAC quota parameter agreement, and service-role secrecy.

These checks are not a Vite production build or a live cloud integration test. This environment had no project credentials. Run `npm install`, `npm test`, `npx playwright install chromium`, `npm run test:e2e`, and `npm run build` before release.

## Live Supabase smoke tests (after setup)

1. Sign out and open `/admin`; verify sign-in is required and no public signup is offered.
2. Create a non-allowlisted Auth test user; confirm `is_admin()` is false and project/certificate/achievement writes and upload are denied. Remove the test user.
3. As admin, add/edit/unpublish/delete a temporary project; verify public updates and reload persistence. Check the profile editor, skill categories, ordering, certificate category CRUD, and private inbox.
4. Upload test PNG and PDF certificates; preview/open/download; edit metadata/category/verification URL; replace and delete. Check anonymous/authenticated direct access to Storage objects fails. Verify preview URLs expire in 600 seconds and the signing function refuses unpublished records.
5. Upload/replace/remove a resume; verify the public preview/download follows the current resume. Remove it and confirm no success is claimed when absent.
6. Submit a valid Turnstile contact form; verify exactly one message appears in the private inbox. Check malformed emails, missing/expired token, unapproved origin, oversized payload and sixth same-email submission within 15 minutes are rejected.
7. Run `supabase test db`, inspect deployment CSP/redirects/canonical URL and console, then remove all smoke-test records and files.

## Boundaries

An already-issued signed URL remains usable until its 10-minute expiry unless the object itself is deleted. A resume is public while a resume record exists. Contact is stored in the private dashboard inbox; no outbound email notification is implemented. Turnstile and per-email quotas do not provide IP-wide abuse control.
