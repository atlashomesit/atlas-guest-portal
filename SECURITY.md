# Security Practices

## Data Handling
- The app is a static client-side SPA. No sensitive customer data is stored server-side.
- Booking and contact forms send payloads directly to EmailJS. Avoid embedding secrets in the client bundle—use environment variables and EmailJS dashboard restrictions.
- Property metadata in [`src/data.ts`](src/data.ts) is public marketing content; review additions for personally identifiable information before merging.

## Dependencies
- Dependencies are managed via npm. Run `npm audit` periodically and patch vulnerabilities as needed.
- Prefer minor/patch upgrades for React, Vite, Swiper, and Fancybox to benefit from security fixes.
- Lockfiles (`package-lock.json`) must be committed with dependency upgrades to ensure reproducible installs.

## Credential Management
- EmailJS service IDs, template IDs, and public keys belong in environment variables (see `.env.example`).
- Never commit production credentials. Rotate keys immediately if leakage is suspected and update `.env` in each environment.
- Cloudflare Pages project access should use scoped API tokens or dashboard roles; avoid sharing global account credentials.

## Secure Development Checklist
- [ ] Validate all user input on forms (basic email validation exists; extend as needed).
- [ ] Confirm third-party scripts (Fancybox, Swiper) are pinned to trusted versions.
- [ ] Review console warnings and TypeScript errors before releasing.
- [ ] Enable HTTPS-only hosting in production to protect EmailJS payloads.

## Reporting Vulnerabilities
If you discover a vulnerability:
1. Email the maintainers at `security@atlashomes.example` (update to real alias).
2. Provide reproduction steps and affected components (e.g., `Homepage_PropertyDetails`, `BookingFrom`).
3. Expect acknowledgment within 3 business days and remediation timeline updates thereafter.
