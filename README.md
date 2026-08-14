# Imadi Platform

Express + TypeScript + PostgreSQL/Prisma backend and the supplied Imadi static frontend. It exposes REST endpoints under `/api`, OpenAPI documentation at `/api/docs`, health at `/health`, and serves the site from `/`.

## Start locally

1. Copy `.env.example` to `.env` and use a strong `SESSION_SECRET` and database password.
2. Run `npm install`, `npm run prisma:generate`, `npm run prisma:migrate`, and `npm run prisma:seed`.
3. Run `npm run dev`, then open `http://localhost:3000`.

The seed administrator is `admin@example.com`; set `SEED_ADMIN_PASSWORD` before seeding. Change or remove this account before production.

## Deployment

The production container applies Prisma migrations before starting the API, runs as a non-root user, and exposes `/health` (process liveness) and `/ready` (database readiness). For deployment, set `NODE_ENV=production`, a unique `SESSION_SECRET` of at least 32 characters, `COOKIE_SECURE=true`, an explicit HTTPS `ALLOWED_ORIGINS` list, and a managed PostgreSQL `DATABASE_URL`. Never use the example database password or seed administrator in production.

`docker compose up --build` is suitable for local container testing. Production should terminate TLS at a reverse proxy or platform load balancer, use managed PostgreSQL backups, and configure SMTP/storage with operational credentials. The public forms have honeypot, validation, rate limiting, structured errors, and source/UTM capture.

## Production deployment checklist

Before deploying, set these values in your host's secret manager (not in Git): `DATABASE_URL`, `SESSION_SECRET` (32+ random characters), `ALLOWED_ORIGINS`, `COOKIE_SECURE=true`, `PUBLIC_SITE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `SALES_NOTIFICATION_EMAIL`.

For the current Netlify site, set `ALLOWED_ORIGINS=https://imadi-technologies.netlify.app` exactly (no trailing slash). A different preview or custom-domain site needs its own exact HTTPS origin. The API now responds directly to `OPTIONS` preflight requests, but this environment value must still match the browser's `Origin` header.

Then run `npx prisma migrate deploy` (the production start command does this automatically), deploy the container behind HTTPS, and verify `/health`, `/ready`, an administrator login, a password-reset email, contact confirmation email, newsletter confirmation/unsubscribe, and an image upload. The compose configuration preserves local image uploads in the `media_uploads` volume; use persistent object storage or an equivalent persistent volume on your production host.

The app refuses production startup until the database, HTTPS URL, session security, allowed origins, and SMTP credentials are configured. Update the seed admin before launch and do not retain the default sample credentials.

### GitHub Pages frontend

The included workflow deploys `public/` to GitHub Pages whenever `main` is pushed. Before publishing, replace `public/config.json`'s `apiBaseUrl` with the HTTPS URL of the deployed API, for example `https://imadi-api.example.com`. Set that URL in the API's `ALLOWED_ORIGINS` environment variable as well (use the complete GitHub Pages origin). GitHub Pages hosts the frontend only; PostgreSQL and the Node API must run on a backend host.

### Netlify frontend

Netlify deploys the static frontend only. The included `netlify.toml` publishes `public/`, which makes `public/index.html` available at `/` rather than at `/public/`. Do not set Netlify's publish directory to the repository root and do not add a `/* /index.html 200` rewrite: this site has multiple HTML pages, not a Vite single-page application.

Before deployment, replace `public/config.json`'s `apiBaseUrl` with the HTTPS URL of the separately deployed API, then set `ALLOWED_ORIGINS` on that API to the exact Netlify site origin (for example, `https://imadi-technologies.netlify.app`). Use an HTTPS API URL so browser requests and administrator sessions are not blocked by mixed-content or cookie security rules.

## Admin security

Login uses a signed HTTP-only cookie; state-changing admin calls must first request `/api/csrf` then send its token as `X-CSRF-Token`. Roles: `super_admin`, `editor`, `sales`. Super administrators control settings and subscriber deletion; editorial staff manage content; sales manages leads.
