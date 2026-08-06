# Nearby

A social platform for talking freely — text now, audio and video planned —
built so a user's data and login stay tied to the account and device they're
using, in ways compliant with the region they're in.

Phase 1 (this build): phone/email + OTP signup, PIN and passkey/biometric
quick relogin per device, real-time text chat, device management, and a
region-aware consent/data-export/erasure framework.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design, what's built
vs. deferred (audio/video calling, native apps, E2EE, etc.), and the
reasoning behind the auth model.

## Getting started

Requires a running PostgreSQL instance.

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL and secrets
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). In development, OTP
codes are printed to the terminal (`[dev-otp] ... your code is ...`)
instead of being sent by SMS/email — see `src/server/auth/otp-delivery.ts`
to wire in a real provider.

## Project layout

- `src/app` — pages (`/login`, `/chat`, `/settings`) and API routes
- `src/server` — auth, chat, and compliance business logic
- `src/components`, `src/lib` — client-side UI and utilities
- `prisma/schema.prisma` — data model
- `server.ts` — custom Node server wiring Next.js + Socket.io together
