# SafeHarbor

A private, AI-assisted messaging app for two people. Each person sets how open they are
to discussing particular topics; messages are checked against those boundaries and
rephrased to match the recipient's preferred tone before the sender approves and sends
them.

Built as a 3-hour MVP from `PLANS/safeharbor-dev-plan.md`. This README is the orientation
document for anyone — human or AI agent — picking the codebase up cold.

---

## Table of contents

- [The core idea](#the-core-idea)
- [Stack](#stack)
- [Running it locally](#running-it-locally)
- [Codebase map](#codebase-map)
- [How the main flows work](#how-the-main-flows-work)
- [Design rules that the code depends on](#design-rules-that-the-code-depends-on)
- [Non-obvious things that will trip you up](#non-obvious-things-that-will-trip-you-up)
- [Testing](#testing)
- [Deployment](#deployment)
- [Known gaps](#known-gaps)

---

## The core idea

Three concepts carry the whole app:

**Connection** — a link between exactly two users. Everything else (messages, topic
settings) hangs off a connection, not off a user directly. This is what makes the app
work for a pair rather than a broadcast feed.

**Topic setting** — a *traffic light* per topic, per connection, set by the **receiver**:

| Level | Meaning | Effect on an incoming message |
|-------|---------|-------------------------------|
| 🟢 `green` | Open | Passes through; rephrased normally |
| 🟡 `yellow` | Handle gently | Passes through; the topic is named to the AI so it softens the wording |
| 🔴 `red` | Not ready | **Held.** Never delivered, and no AI call is made |

The asymmetry matters: *you set boundaries for what you receive*, and the sender's
message is checked against **their partner's** settings, not their own.

**Tone Tuner** — the compose flow. Write freely, the AI rephrases to match the
receiver's preferences, you review both versions side by side, then you choose to send.
Nothing is delivered without the sender explicitly approving it.

---

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 16 (App Router) | Pages and API routes in one deployable unit |
| Styling | Tailwind CSS 4 | Mobile-first; no separate stylesheet to maintain |
| Database | PostgreSQL | Relational data with a `String[]` column for topic tags |
| ORM | Prisma 7 | Typed queries and versioned migrations |
| AI | Pluggable provider chain (Claude, OpenAI) | Tone rephrasing, with failover |
| Auth | Magic links + JWT (`jose`) | No passwords to store or leak |
| Email | Nodemailer | Magic-link delivery; logs to console when unconfigured |
| Tests | Jest | Unit and AI-as-judge tests |

---

## Running it locally

### Prerequisites

- Node.js 24 (see `.nvmrc`)
- PostgreSQL running locally
- A Claude API key (optional — the app runs without it, but Tone Tuner will hold every
  message as a draft)

### Setup

```bash
cd safeharbor
npm install                    # postinstall runs `prisma generate`

createdb safeharbor            # create the local database
createdb safeharbor_test       # used by integration tests
```

Create **two** env files. They are read by different tools (this catches people out —
see [Non-obvious things](#non-obvious-things-that-will-trip-you-up)):

**`.env`** — read by the Prisma CLI only:

```env
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/safeharbor"
```

**`.env.local`** — read by the Next.js app:

```env
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/safeharbor"
TEST_DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/safeharbor_test"
ANTHROPIC_API_KEY="sk-ant-..."
JWT_SECRET="generate-me"
MAGIC_LINK_SECRET="generate-me-separately"
BASE_URL="http://localhost:3000"
SMTP_HOST=""
```

Generate the two secrets with **different** values:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`.env.example` is the committed template. Both `.env` and `.env.local` are gitignored —
never commit either.

Apply the schema and start:

```bash
npm run db:migrate             # applies prisma/migrations
npm run dev                    # http://localhost:3000
```

### Signing in without email configured

With `SMTP_HOST` empty, magic links are **printed to the terminal** running `npm run dev`
instead of being emailed:

```
🔗 Magic link for you@example.com:
http://localhost:3000/api/auth/verify?token=6362e3ec...
```

Paste that into the browser. To test the two-person flow, sign in as the first user,
send an invite from `/invite`, then open the invite link that appears in the same
terminal — it signs you in as the second user and creates the connection.

### Commands

| Command | Does |
|---------|------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | `prisma generate` then production build |
| `npm start` | Serve the production build (respects `PORT`) |
| `npm test` | Unit tests — free, fast, no network |
| `npm run test:ai` | AI quality + injection tests — **costs money**, needs an API key |
| `npm run test:all` | Everything, serially |
| `npm run db:migrate` | Create/apply a migration locally |
| `npm run db:deploy` | Apply committed migrations (production) |
| `npm run db:studio` | Browse the database in a GUI |
| `npm run lint` | ESLint |

---

## Codebase map

```
safeharbor/
├── prisma/
│   ├── schema.prisma              # Source of truth for the data model
│   └── migrations/                # Versioned SQL — commit these
│
├── src/
│   ├── lib/                       # Framework-free business logic. Start reading here.
│   │   ├── db.js                  # Prisma singleton (needs a driver adapter — see gotchas)
│   │   ├── env.js                 # Lazy, fail-loud resolution of required secrets
│   │   ├── auth.js                # Magic tokens, JWT sessions, getSessionUser()
│   │   ├── topics.js              # SINGLE source of truth: keys + labels + keywords
│   │   ├── topic-checker.js       # Deterministic keyword boundary check (no AI, free)
│   │   ├── connections.js         # The one connection-ownership authorization path
│   │   ├── http.js                # Safe JSON body parsing + input validation
│   │   ├── mailer.js              # SMTP with console fallback for local dev
│   │   ├── feature-flags.js       # Static flags gating Phase 2 features
│   │   ├── base-url.js            # Public URL resolution (required in production)
│   │   └── ai/                    # Provider-agnostic AI layer
│   │       ├── index.js           # rephraseMessage() — the only public entry
│   │       ├── prompt.js          # Prompt build + injection sanitization
│   │       ├── errors.js          # ProviderError: refusal vs infrastructure
│   │       └── providers/
│   │           ├── anthropic.js   # Claude, via @anthropic-ai/sdk
│   │           └── openai.js      # GPT, via fetch (no extra dependency)
│   │
│   ├── components/                # Client components, all presentational
│   │   ├── AuthGuard.js           # Redirects to / when unauthenticated
│   │   ├── BottomNav.js           # Fixed mobile nav (Inbox / Compose / Settings)
│   │   ├── TrafficLight.js        # One topic's green→yellow→red toggle
│   │   └── MessageCard.js         # One inbox message
│   │
│   ├── app/
│   │   ├── layout.js              # Root layout, fonts, viewport
│   │   ├── page.js                # Landing + magic-link request (public)
│   │   │
│   │   ├── (app)/                 # Route group: every page here requires auth
│   │   │   ├── layout.js          # Wraps children in AuthGuard + BottomNav
│   │   │   ├── dashboard/         # Hub with links to the main actions
│   │   │   ├── compose/           # Tone Tuner UI
│   │   │   ├── inbox/             # Received messages
│   │   │   ├── settings/          # Topic traffic-light grid
│   │   │   └── invite/            # Invite your partner
│   │   │
│   │   └── api/
│   │       ├── health/            # Deploy healthcheck (app + DB)
│   │       ├── auth/
│   │       │   ├── request-link/  # POST email → send/log magic link
│   │       │   ├── verify/        # GET token → set session cookie, redirect
│   │       │   └── me/            # GET current user
│   │       ├── invite/            # POST invite; GET accept/ → create Connection
│   │       ├── connections/       # GET the user's connections + partner names
│   │       ├── settings/topics/   # GET all levels; PUT one level
│   │       └── messages/
│   │           ├── compose/       # POST draft → boundary check → AI rephrase
│   │           ├── send/          # POST approve a draft → deliver
│   │           └── inbox/         # GET received messages
│   │
│   └── generated/prisma/          # GENERATED + GITIGNORED. Never edit; never rely on
│                                  # it existing in a fresh clone.
├── tests/
│   ├── topic-checker.test.js      # Boundary logic — the most important unit tests
│   ├── topics.test.js             # Registry coverage guard (see Design rule 8)
│   ├── ai-provider-chain.test.js  # Error classification + sanitization, no network
│   ├── feature-flags.test.js
│   ├── ai-boundaries.test.js      # Boundary scenarios incl. documented false positives
│   ├── ai-quality.test.js         # AI-as-judge rephrase quality (real API calls)
│   ├── ai-injection.test.js       # Prompt-injection resistance (real API calls)
│   └── helpers/
│       ├── ai-judge.js            # Independent judge — must NOT see ai.js's prompt
│       └── test-db.js             # Test fixtures against TEST_DATABASE_URL
│
├── railway.json                   # Railway build/migrate/start/healthcheck
├── .nvmrc                         # Node 24
├── prisma7.config.ts              # Prisma 7 CLI config (reads .env via dotenv)
└── .env.example                   # Template — the real .env files are gitignored
```

**Where to start reading:** `src/lib/topic-checker.js` and `src/lib/ai.js` hold the
actual product logic and have no framework dependencies. Then
`src/app/api/messages/compose/route.js`, which orchestrates them.

---

## How the main flows work

### Authentication (passwordless)

```
POST /api/auth/request-link  { email }
   │  generateMagicToken() → random 32 bytes
   │  stores ONLY sha256(plaintext + MAGIC_LINK_SECRET + purpose)
   │  emails/logs the plaintext
   │  always returns { sent: true }        ← never reveals if the email is registered
   ▼
GET /api/auth/verify?token=...
   │  re-hash the token, look it up, check consumed + expiry (15 min)
   │  mark consumed  → single use
   │  upsert the user, sign a 7-day JWT
   │  set httpOnly session cookie → redirect /dashboard
```

Tokens are **purpose-scoped**: the purpose string is mixed into the hash, so a `login`
token cannot be replayed as an `invite` token even if stolen.

### Sending a message (the core loop)

```
POST /api/messages/compose  { connectionId, contentRaw }
   │
   ├─ authenticate; verify the caller belongs to this connection  → else 403
   ├─ resolve the OTHER user as the receiver
   ├─ load the RECEIVER's topic settings
   │
   ├─ checkTopicBoundaries(contentRaw, receiverSettings)      ← free, deterministic
   │     │
   │     ├─ any RED topic matched?
   │     │     └─ save status:"held", heldReason:"red_topic"
   │     │        return { held: true }            ← NO AI CALL (saves money)
   │     │
   │     └─ collect YELLOW topics → pass to the AI as "handle gently"
   │
   ├─ rephraseMessage(contentRaw, { tonePreference, yellowTopics })
   │     │
   │     ├─ AI failed? → save status:"draft", heldReason:"ai_failed"
   │     │               return { held: true }     ← never offers to send raw
   │     │
   │     └─ success → save draft with BOTH versions
   │
   └─ return { raw, rephrased } for the sender to review

POST /api/messages/send  { messageId, versionSent }
   └─ set senderApproved:true, status:"sent", sentAt:now()
```

The receiver only ever reads what the sender approved. `GET /api/messages/inbox` filters
on `status:"sent"` **and** `senderApproved:true`, returns a single `content` field
resolved from `versionSent`, and never exposes `contentRaw` for a rephrased message.

### Setting boundaries

`GET /api/settings/topics?connectionId=…` returns all 10 preset topics, defaulting any
that have no row yet to `green`. The UI therefore always renders a full grid, and `PUT`
upserts a single topic. There is no "initialize settings" step.

---

## Design rules that the code depends on

These come from the original plan and are load-bearing — breaking one changes the
product's safety guarantees, not just its behaviour.

1. **Fail closed.** If the AI is unavailable, the message becomes a draft. There is
   deliberately **no** "send it raw anyway" path: an unfiltered message is exactly what
   the app exists to prevent.

2. **The deterministic check runs first.** `topic-checker.js` is free and instant. A Red
   topic short-circuits before any paid API call. Never reorder this.

3. **The receiver's settings govern.** A sender cannot see or override their partner's
   topic levels.

4. **`contentRaw` is always stored, never delivered.** The original is kept (for the
   sender's own review and future ML); the receiver is served `contentRephrased`.

5. **Receiver preferences are data, not instructions.** `ai.js` validates
   `tonePreference` against an allow-list and strips non-alphanumerics from topic labels
   before they reach the prompt. A malicious custom topic cannot become an instruction.
   `tests/ai-injection.test.js` guards this.

6. **The test judge is independent.** `tests/helpers/ai-judge.js` must never import or
   duplicate the system prompt from `ai.js`. A judge that has seen the writer's prompt
   grades to the prompt instead of to the outcome.

7. **Timestamps are UTC in the database**, serialized as ISO strings, and localized only
   in the browser (`MessageCard.js`).

8. **A boundary that cannot be enforced must never be accepted.** Topic keys, labels, and
   keywords live together in `src/lib/topics.js`, and `PUT /api/settings/topics` rejects
   any topic not in it. Previously those three lists lived in three files: an unknown
   topic could be stored as Red, hidden from `GET`, and silently ignored by the checker —
   a fail-*open* hole in the app's central promise. `tests/topics.test.js` fails the build
   if any topic loses its keywords.

9. **Only `contentRephrased` is deliverable.** `POST /api/messages/send` rejects
   `versionSent: "raw"` and the inbox query does not even `select` `contentRaw`. The UI
   never offered raw sending, but the API once accepted it, so a single `curl` could
   defeat the product's entire purpose.

10. **Secrets fail loudly.** `src/lib/env.js` throws when `JWT_SECRET` or
    `MAGIC_LINK_SECRET` is missing, and `base-url.js` throws in production without
    `BASE_URL`. There are deliberately no fallback defaults to silently sign with.

---

## Non-obvious things that will trip you up

**`.env` and `.env.local` are both needed, and are read by different tools.**
Next.js reads `.env.local`. The Prisma CLI reads `.env` (via `dotenv` in
`prisma7.config.ts`) and does **not** read `.env.local`. If migrations fail with a
connection error while the app works fine, `.env` is the file to check.

**Prisma 7 requires a driver adapter.** `new PrismaClient()` with no arguments throws
`PrismaClientInitializationError`. `src/lib/db.js` must construct `PrismaPg` and pass it
as `{ adapter }`. This differs from Prisma 5/6 patterns you may have seen.

**The generated client is gitignored.** `src/generated/prisma/` does not exist in a fresh
clone. `prisma generate` runs via `postinstall` *and* inside `build` for this reason —
do not remove either, or deploys break with `Module not found`.

**Local Postgres usually needs an explicit username.** `postgresql://localhost:5432/db`
fails with `P1010: User was denied access`; use
`postgresql://YOUR_USERNAME@localhost:5432/db`.

**`package.json` sets `"type": "module"`.** Added so Jest can run the app's ESM source.
Consequently the test scripts need `node --experimental-vm-modules`, which is why they
invoke Jest's binary directly rather than running `jest`.

**Pages under `src/app/(app)/` are auth-gated by the group layout.** A new authenticated
page belongs in that folder and needs no guard of its own. A new page outside it is
public by default.

**`AuthGuard` is a client-side redirect, not a security boundary.** It improves UX only.
Every API route independently calls `getSessionUser()` and returns 401/403. Server-side
checks are the real enforcement — keep them in any new route.

**The keyword matcher has known false positives.** "I am fighting a cold" trips the
`past_conflicts` topic. This is a documented Phase 1 limitation; the case is commented
out in `tests/ai-boundaries.test.js` rather than deleted, as a marker for the Phase 2
AI-assisted classifier.

---

## Testing

Three layers, deliberately separated by cost:

| Layer | Command | Cost | Run when |
|-------|---------|------|----------|
| Unit — boundaries, flags | `npm test` | Free, <1s | Every change |
| AI quality — judge-scored | `npm run test:ai` | ~$0.30 | Before deploying; after prompt edits |
| Injection resistance | included in `test:ai` | ~$0.10 | After touching `ai.js` |

```bash
npm test                 # 16 tests, no network, no API key needed
```

The AI tests are **skipped gracefully** when `ANTHROPIC_API_KEY` is absent rather than
failing, so `test:all` stays usable without a key.

The AI-as-judge pattern: run a message through the real feature, then have a *separate*
Claude call score the output on meaning preservation, tone match, added content, and
naturalness. Thresholds live in `tests/ai-quality.test.js`; meaning preservation requires
≥4/5 because a rephrase that changes meaning is the worst failure this app can have.

Integration tests (`tests/api-messages.test.js`, `tests/api-settings.test.js`) are
referenced by `npm run test:integration` and specified in
`PLANS/safeharbor-testing-plan.md`, but are **not yet written** — the fixtures in
`tests/helpers/test-db.js` are ready for them.

---

## Deployment

See **`PLANS/safeharbor-deployment-plan.md`** for the full walkthrough.

Short version: Railway, with a PostgreSQL service in the same project. `railway.json`
already defines the build, the `prisma migrate deploy` pre-deploy step, the start
command, and a `/api/health` healthcheck. You supply `DATABASE_URL`,
`ANTHROPIC_API_KEY`, `JWT_SECRET`, `MAGIC_LINK_SECRET`, and `BASE_URL` as Railway
variables.

Verify a deploy with:

```bash
curl https://<your-domain>/api/health
# {"status":"ok","database":"connected"}
```

---

## Swapping or adding an AI provider

The AI layer is provider-agnostic. Selection is entirely env-driven:

```env
AI_PROVIDER_CHAIN="anthropic,openai"   # tried in order
AI_MODEL_ANTHROPIC="claude-sonnet-4-5"
AI_MODEL_OPENAI="gpt-4o"
```

Providers without an API key are skipped, so the chain degrades rather than erroring.
The failover rule is the important part:

- **Infrastructure failure** (timeout, 429, 5xx, auth, network) → try the next provider.
  The content was never fairly judged.
- **Content refusal** (the provider evaluated the text and declined) → **stop**. Another
  provider would very likely refuse too, and the product requires surfacing the refusal
  rather than shopping for a yes.

Each adapter classifies its own errors, because only it understands its SDK's error
shape; `index.js` reads nothing but `err.kind`.

**To add a provider:** create `src/lib/ai/providers/<name>.js` exporting `name`,
`isConfigured()`, `defaultModel()`, and `async complete({system, userMessage, model,
maxTokens})` returning `{text, model, tokensUsed}` and throwing `ProviderError`. Register
it in the `REGISTRY` map in `index.js`. Nothing else changes — the prompt, the
sanitization, the return shape, and the database columns are all provider-independent.

---

## Known gaps

Accurate as of this commit — worth knowing before you plan work.

- **No integration tests yet** (see [Testing](#testing)). `tests/helpers/test-db.js` has
  the fixtures ready.
- **No rate limiting** on `/api/auth/request-link`. It cannot be used to enumerate
  accounts, but it can be used to spam a known address.
- **Custom topics are unimplemented.** `TopicSetting` has `isCustom` and
  `sanitizedLabel` columns, but only the 10 registry topics are accepted. Supporting
  custom topics requires a way to derive keywords for them — otherwise the boundary
  cannot be enforced, which `PUT /api/settings/topics` now correctly refuses.
- **Inbox has no realtime updates or unread state.** It polls on mount and on a manual
  Refresh press.
- **Held messages are invisible after the fact.** A `red_topic` message is stored with
  `status:"held"` but no screen lists them, so the sender cannot revisit or retry one.
- **Phase 2 features are flagged off** in `feature-flags.js`: Know Me Dashboard, Practice
  Pad, AI Companions, photo uploads, push notifications, payments.
