# Deploying

The app ships as a Docker image (`Dockerfile`), so any host that runs
containers works. It needs a persistent process (for the Socket.io
connection) and a Postgres database — see [ARCHITECTURE.md](./ARCHITECTURE.md)
for why a custom server is used instead of plain `next start`.

## Fastest path: Render

1. Push this repo to GitHub (already done if you're reading this on the branch).
2. In Render: **New +** → **Blueprint**, point it at this repo. It reads
   [`render.yaml`](./render.yaml) and provisions a free Postgres database plus
   a web service built from the `Dockerfile`, wiring `DATABASE_URL`
   automatically and generating the JWT secrets.
3. Once deployed, open the service settings and update `WEBAUTHN_RP_ID` and
   `WEBAUTHN_ORIGIN` to match the real `https://your-app.onrender.com` (or
   custom domain) — passkeys silently fail if these don't match exactly.
4. Wire a real OTP provider before inviting real users (see below).

## Railway / Fly.io / any Docker host

Same `Dockerfile` works as-is:

```bash
railway init && railway up          # Railway auto-detects the Dockerfile
# or
fly launch                          # Fly.io: accept the detected Dockerfile
```

Add a Postgres instance (Railway/Fly both offer one-click managed Postgres),
then set the environment variables listed below on the service.

## Required environment variables

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Long random strings (`openssl rand -hex 32`), unique to this deployment |
| `WEBAUTHN_RP_ID` | Your real domain, no scheme (e.g. `nearby.app`) |
| `WEBAUTHN_ORIGIN` | Full origin (e.g. `https://nearby.app`) — must exactly match what users load |
| `OTP_PROVIDER` | Set once you wire a real provider (below); informational only until then |

The container's `docker-entrypoint.sh` runs `prisma migrate deploy`
automatically on every start, so schema changes ship with the next deploy —
no separate migration step needed.

## Wire a real OTP provider

Out of the box, verification codes are only logged to the server's console
(`src/server/auth/otp-delivery.ts`) — nobody actually receives an SMS or
email. Before any real user signs up:

1. Implement `OtpDeliveryProvider` (`sendSms`/`sendEmail`) against a real
   provider — Twilio for SMS, Resend/Postmark/SES for email are common
   choices.
2. Call `setOtpProvider(new YourProvider())` once at startup (e.g. at the top
   of `server.ts`, guarded by `process.env.NODE_ENV === "production"`).

## Local Docker (optional)

To run the containerized build locally instead of `npm run dev`:

```bash
docker compose up --build
```

This starts Postgres and the app together (`docker-compose.yml`), applying
migrations automatically, at `http://localhost:3000`.

## Before real users touch this

This is a phase-1 build (see ARCHITECTURE.md's "What's deliberately not
built yet"). At minimum, before a public launch: wire the real OTP provider
above, have counsel review the compliance rulesets for every region you'll
operate in, and add basic uptime/error monitoring — none of that exists yet.
