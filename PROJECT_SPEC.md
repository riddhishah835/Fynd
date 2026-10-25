# Fynd: Project Spec (Source of Truth)

*Sponsor-event marketplace with an AI layer. MERN stack. Built in 3 days (deadline: 27 Oct 2026, 11:59 PM IST).*

## 0. Rules for AI Agents (READ FIRST)

1. This document is the single source of truth. Do not change the stack, data model, endpoints, or status flow without the human explicitly approving it.
2. Do not add features that are not listed here. If something seems missing, ask the human.
3. Build in the milestone order in Section 12. Do not start a later milestone before the current one works end to end.
4. UI stays simple: Tailwind utility classes, plain components, no UI polish, no animation libraries. Functionality first.
5. Never hardcode secrets. All secrets come from `.env`. Never commit `.env`. Keep `.env.example` updated.
6. Every API endpoint validates input with Zod and returns errors in the standard format (Section 9).
7. Every frontend page that fetches data handles three states: loading, error, empty.
8. Make small, focused commits with clear messages (`feat: ...`, `fix: ...`, `chore: ...`). Never dump everything in one commit.
9. All proposal status changes go through the single service function `transitionProposal()` (Section 6). No controller may set `status` directly.
10. Keep code simple and readable. No unnecessary abstractions, no extra libraries beyond Section 3.

## 1. Product Summary

**Fynd** connects small companies that want visibility with event organizers (college fests, community events, meetups, hackathons) that need sponsorship.

- **Problem:** Small businesses can't easily find affordable, relevant events to sponsor. Organizers chase sponsors through cold emails and WhatsApp with no structure.
- **Target users:** (a) Organizers: student fest teams, clubs, community event holders. (b) Sponsors: small and mid-size companies, startups, local brands.
- **Solution:** A two-sided platform where organizers list events with sponsorship tiers, sponsors discover events through filters and AI matching, and both sides run the whole deal (proposal, negotiation, chat, deliverables) in one place.

## 2. Roles

Two roles chosen at signup, fixed afterwards: `organizer` and `sponsor`. Separate signup tabs for each. Role is stored in the JWT and checked by middleware.

| Capability | Organizer | Sponsor |
| --- | --- | --- |
| Create/edit/delete own events and tiers | Yes | No |
| Browse and search all published events | Yes (read only) | Yes |
| Send proposal to an event | No | Yes |
| Accept, reject, counter a proposal | Yes (own events only) | No |
| Accept or reject a counter-offer, withdraw proposal | No | Yes (own proposals only) |
| Chat on a proposal | Participants only | Participants only |
| Create and update deliverables | Yes (mark delivered, upload proof) | Approve or dispute |
| Use AI features | Pitch generator, assistant | Proposal drafter, assistant, matches |

## 3. Tech Stack (fixed)

**Frontend:** React 18 + Vite, React Router, Tailwind CSS, Axios, socket.io-client. JavaScript (no TypeScript, for speed).

**Backend:** Node.js 20, Express, Mongoose, Zod (validation), jsonwebtoken (JWT), bcryptjs, cookie-parser, cors, helmet, express-rate-limit, multer (uploads), socket.io, dotenv, morgan.

**Database:** MongoDB Atlas free tier (M0), including Atlas Vector Search for embeddings.

**AI (behind one swappable module, `server/src/services/llm.js`):**

- Chat and tool calling: Groq API (Llama 3.3 70B, free tier), OpenAI-compatible SDK (`openai` npm package pointed at the Groq base URL).
- Embeddings: Google Gemini embeddings API (free tier). Check the current model name in the docs when implementing.
- Fallback: OpenRouter free models, same OpenAI-compatible client. Switching providers must only require changing env vars and the model name.

**File storage:** Cloudinary free tier (event banners, deliverable proof images, media kits).

**Deployment:** Backend on Render (free web service, supports WebSockets). Frontend on Vercel. Database on Atlas.

**Testing:** Vitest + Supertest for a small set of backend tests (Section 11). No frontend tests.

**Free-tier limits change.** Verify current limits and model names before relying on them.

In production the client calls the API through a Vercel rewrite at /api (same-origin), so VITE_API_URL=/api in production. Socket.io connects directly to the Render URL via VITE_SOCKET_URL.

## 4. Repository Structure

```text
Fynd/
  README.md
  PROJECT_SPEC.md          (this document, kept in repo root)
  .gitignore
  client/
    .env.example
    src/

      main.jsx
      App.jsx
      api/axios.js         (axios instance, withCredentials)
      context/AuthContext.jsx
      components/          (Navbar, ProtectedRoute, Loader, ErrorBox, Empty, StatusBadge)
      pages/
        Landing.jsx
        Login.jsx
        Signup.jsx
        Events.jsx             (browse + filters + matches)
        EventDetail.jsx
        OrganizerDashboard.jsx
        SponsorDashboard.jsx
        EventForm.jsx          (create/edit)
        ProposalDetail.jsx     (status, history, chat, deliverables)
        Assistant.jsx
        Notifications.jsx
  server/
    .env.example
    src/
    app.js(express app, exported for tests)
      index.js             (creates http server, socket.io, connects DB, starts listening)
      config/db.js
      config/env.js
      models/              (User, Event, Proposal, Message, Deliverable, Notification)
      routes/              (auth, events, proposals, messages, deliverables, notifications, ai)
      controllers/
      middleware/          (auth, requireRole, validate, errorHandler, upload)
      services/
        proposalService.js (transitionProposal, state machine)
        llm.js             (chat, embed)
        matchService.js
        assistantService.js (tool definitions + loop)
        notificationService.js
      validators/          (zod schemas)
      sockets/chat.js
    tests/
```

## 5. Data Model (Mongoose)

**User**

- `name`, `email` (unique, lowercase), `passwordHash`, `role` (`organizer` | `sponsor`)
- `organization` (string), `city`, `bio`, `website`
- Sponsor only: `industry`, `targetAudience` (string), `budgetMin`, `budgetMax`, `goals` (string), `embedding` (number\[\])
- Organizer only: `orgType` (college, club, community, other)
- `createdAt`

**Event**

- `organizer` (ref User), `title`, `description`, `category` (tech, cultural, sports, business, music, social, other)
- `city`, `venue`, `startDate`, `endDate`
- `expectedFootfall` (number), `audienceProfile` (string: age range, interests)
- `bannerUrl`, `status` (`draft` | `published` | `closed`)
- `tiers`: array of `{ _id, name, price, slots, slotsFilled (default 0), benefits: [string] }`
- `embedding` (number\[\]), `createdAt`
- Rule: `slotsFilled` must never exceed `slots`.

**Proposal**

- `event` (ref), `tierId`, `sponsor` (ref User), `organizer` (ref User)
- `amount` (number, the currently proposed amount), `message` (string)
- `status` (see Section 6), `counterNote` (string)
- `history`: array of `{ from (status), to (status), by (userId), note, at }`
- `createdAt`, `updatedAt`
- Unique rule: one active proposal per (sponsor, event, tier). Active means status is `pending` or `countered`.

**Message** (chat, one thread per proposal)

- `proposal` (ref), `sender` (ref User), `text`, `createdAt`

**Deliverable** (created automatically when a proposal becomes `accepted`, one per tier benefit)

- `proposal` (ref), `title` (copied from tier benefit), `status` (`pending` | `delivered` | `approved` | `disputed`), `proofUrl`, `note`, `updatedAt`

**Notification**

- `user` (ref), `type`, `text`, `link` (client route), `read` (bool), `createdAt`

## 6. Proposal State Machine (core logic)

Statuses: `pending`, `countered`, `accepted`, `rejected`, `withdrawn`, `completed`.

| From | To | Who can do it | Notes |
| --- | --- | --- | --- |
| (new) | `pending` | Sponsor | Fails if tier is full or an active proposal already exists |
| `pending` | `accepted` | Organizer of the event | Atomically increments `tier.slotsFilled`; fails if no slots left |
| `pending` | `rejected` | Organizer | Requires a note |
| `pending` | `countered` | Organizer | Sets a new `amount` and `counterNote` |
| `pending` | `withdrawn` | Sponsor |  |
| `countered` | `accepted` | Sponsor | Atomically increments `slotsFilled`; fails if no slots left |
| `countered` | `rejected` | Sponsor |  |
| `countered` | `pending` | Sponsor | Sponsor re-counters with a new amount |
| `accepted` | `completed` | Organizer | Allowed only when all deliverables are `approved` |
| `accepted` | `withdrawn` | Either party | Decrements `slotsFilled` |

Implementation requirements:

- All transitions go through `transitionProposal({ proposalId, actor, toStatus, payload })` in `proposalService.js`. It checks the table above, verifies the actor owns the proposal, updates the proposal, appends to `history`, creates notifications for the other party, and creates deliverables on acceptance.
- Slot reservation must be atomic: use `Event.findOneAndUpdate({ _id, tiers: { $elemMatch: { _id: tierId, $expr: ... } } }, { $inc: ... })` or an equivalent conditional update so two simultaneous acceptances cannot oversell a tier. If it fails, return `409` with message `Tier is full`.
- Invalid transitions return `409` with message `Invalid status transition`.
- Unit-test this function (Section 11).

## 7. Workflows (the 5 that must work)

1. **Onboarding:** Signup as organizer or sponsor, profile fields collected per role, login, role-based dashboard redirect.
2. **Event publishing:** Organizer creates an event with tiers and benefits, uploads a banner, saves as draft, publishes. Optional AI prefill from pasted description (Section 8.4).
3. **Discovery:** Sponsor browses published events with filters (city, category, date range, max tier price, min footfall) and text search. A "Recommended for you" section shows AI matches with a reason for each.
4. **Deal flow:** Sponsor sends proposal, organizer accepts, rejects, or counters, sponsor responds to a counter. Full history is visible. Every change creates a notification. Each proposal has its own real-time chat.
5. **Delivery tracking:** After acceptance, deliverables appear. Organizer marks each delivered with proof. Sponsor approves or disputes. When all are approved, organizer marks the proposal completed.

## 8. AI Features (exactly these four)

All AI calls go through `llm.js`. Every AI endpoint must: require auth, be rate limited (10 requests per minute per user), time out after 20 seconds, and return a clean error with a fallback message if the provider fails. The app must remain fully usable if AI is down.

### 8.1 Proposal Drafter (sponsor)

- Endpoint: `POST /api/ai/draft-proposal` with `{ eventId, tierId, tone? }`.
- Server loads event, tier, and the sponsor's profile, builds a prompt from real data, and returns `{ draft }`. The sponsor can edit before sending. Never auto-send.

### 8.2 Semantic Matching (sponsor)

- On event publish and on sponsor profile save, generate an embedding from a text blob (title, description, category, audience, city for events; industry, audience, goals for sponsors) and store it.
- Endpoint: `GET /api/ai/matches` uses Atlas Vector Search on events with a pre-filter (published, `tier price <= budgetMax`, upcoming). Re-rank the top 10 with a small weighted score: 0.6 semantic + 0.2 budget fit + 0.1 city match + 0.1 footfall. Return top 5 with `score` and a `reason` (one sentence generated by the LLM from the actual fields; if the LLM fails, fall back to a templated reason).
- If vector search is unavailable, fall back to category and city filtering so the feature still returns results.

### 8.3 Tool-Calling Assistant (both roles)

- Endpoint: `POST /api/ai/assistant` with `{ messages }` (conversation history from the client; the server stays stateless).
- Implemented in `assistantService.js` as an agent loop (max 5 tool-call rounds). The model can only act through these tools, and each tool enforces the caller's role and ownership server-side (never trust the model for authorization):
  - `search_events({ city?, category?, maxPrice?, minFootfall?, query? })` (sponsor)
  - `get_event({ eventId })`
  - `list_my_proposals({ status? })`
  - `get_proposal({ proposalId })` (participants only)
  - `suggest_tier({ eventId })` (sponsor, based on budget range)
  - `summarize_chat({ proposalId })` (participants only)
  - `list_pending_actions()` (what needs my response)
- The assistant never performs state-changing actions (no accept, reject, send). It informs and drafts only.
- The system prompt states the user's role and tells the model to answer only from tool results.

### 8.4 Smart Event Prefill (organizer)

- Endpoint: `POST /api/ai/extract-event` with `{ text }`.
- The LLM returns JSON (validated with Zod) containing title, category, city, venue, dates, footfall, audience, and suggested tiers. Frontend prefills the event form; the organizer reviews and edits. On invalid JSON, retry once, then return a clear error.

## 9. API Specification

Base path `/api`. Auth uses an httpOnly cookie named `token` (JWT, 7 day expiry, `sameSite: 'none'`, `secure: true` in production). Standard error format for every failure:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human readable message", "details": [] } }
```

Codes: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `AI_UNAVAILABLE` (503), `SERVER_ERROR` (500).

**Auth**

- `POST /auth/signup`: `{ name, email, password, role, organization, city, ...roleFields }`
- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `PUT /auth/profile`

**Events**

- `GET /events`: query: `q, city, category, from, to, maxPrice, minFootfall, page, limit` (published only)
- `GET /events/:id`
- `GET /events/mine/list` (organizer)
- `POST /events`, `PUT /events/:id`, `DELETE /events/:id` (organizer, owner only; cannot delete or edit tier prices if accepted proposals exist)
- `POST /events/:id/publish`
- `POST /events/:id/banner` (multipart upload)

**Proposals**

- `POST /proposals`: `{ eventId, tierId, amount, message }` (sponsor)
- `GET /proposals`: my proposals, optional `status` filter (role-aware)
- `GET /proposals/:id` (participants only)
- `POST /proposals/:id/transition`: `{ toStatus, amount?, note? }` (runs `transitionProposal`)

**Messages**

- `GET /proposals/:id/messages`, `POST /proposals/:id/messages`
- Socket.io: client joins room `proposal:<id>` after server verifies participation via the cookie; event `message:new` is broadcast to the room.

**Deliverables**

- `GET /proposals/:id/deliverables`
- `PATCH /deliverables/:id`: organizer sets `delivered` with `proofUrl`/`note`; sponsor sets `approved` or `disputed`
- `POST /deliverables/:id/proof` (multipart upload)

**Notifications**

- `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`
- The client polls every 20 seconds (no push, no email).

**AI**

- `POST /ai/draft-proposal`, `GET /ai/matches`, `POST /ai/assistant`, `POST /ai/extract-event`

## 10. Frontend Requirements

- Routes are protected by role via `ProtectedRoute`. Unauthorized users are redirected to login.
- Navbar differs by role (organizer: My Events, Proposals, Assistant, Notifications; sponsor: Discover, My Proposals, Assistant, Notifications).
- `ProposalDetail` is the most important page: shows event and tier, current amount, status badge, history timeline, action buttons that appear only when the current status and role allow them, the chat panel, and the deliverables list.
- Forms show inline validation errors from the server `details`.
- Use a simple toast or inline message for success and failure of every action.
- No design system, no icons library required. Plain, readable, responsive enough to use on a laptop.

## 11. Security, Reliability, Testing

- Passwords hashed with bcrypt (cost 10). Never return `passwordHash`.
- Helmet, CORS restricted to the client origin from env, rate limit on `/auth` (20 per 15 min) and on AI routes.
- Authorization checked in the service or controller, never only in the UI. Users can only read proposals, messages, and deliverables they participate in.
- Validate all bodies, params, and query strings with Zod. Limit upload size (5 MB) and restrict to images and PDFs.
- Sanitize strings that render as HTML (React escapes by default; never use `dangerouslySetInnerHTML`).
- Global error handler returns the standard error format and never leaks stack traces in production.
- **Required backend tests (Vitest + Supertest):** (1) signup and login, (2) role guard blocks sponsor from creating events, (3) valid and invalid proposal transitions, (4) tier slot cannot be oversold (two accepts, one slot), (5) non-participant cannot read a proposal.

## 12. Milestones (build in this order)

**Day 1 (foundation and organizer side)**

1. Repo, folder structure, Express + Mongo connection, env config, error handler, health route.
2. Auth (signup, login, logout, me), role middleware, React auth context, protected routes.
3. Event CRUD with tiers, banner upload, publish. Organizer dashboard and event form.
4. **Deploy a working skeleton** (Render + Vercel + Atlas) before ending the day.

**Day 2 (core marketplace)** 5. Event browsing with filters and search. Event detail page. 6. Proposal creation and `transitionProposal` with atomic slots and history. Notifications. 7. `ProposalDetail` page with status actions. Real-time chat (Socket.io). 8. Deliverables auto-creation and the delivery workflow.

**Day 3 (AI, tests, polish, submission)** 9. AI: `llm.js`, proposal drafter, semantic matching, event prefill, assistant with tools. 10. Backend tests, fix bugs, loading, empty, and error states everywhere. 11. Seed script with demo data (5 organizers, 5 sponsors, 12 events, some proposals in each status). 12. README, demo video, final deployment check, incognito link check, submit the form before the deadline.

**Cut order if time runs short:** event prefill, then assistant tools beyond the first four, then match re-ranking weights, then deliverable disputes. Never cut: auth, event publishing, proposal workflow, chat, deployment, README.

## 13. Environment Variables

**server/.env.example**

```text
PORT=5000
NODE_ENV=development
MONGO_URI=
JWT_SECRET=
CLIENT_URL=http://localhost:5173
GROQ_API_KEY=
GROQ_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.3-70b-versatile
LLM_FALLBACK_MODEL=llama-3.1-8b-instant
GEMINI_API_KEY=
EMBEDDING_MODEL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

**client/.env.example**

```text
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

## 14. README Checklist (required by the submission rules)

Project name, problem statement, target users, solution, key features, tech stack, architecture (with a simple diagram of client, API, DB, AI provider, Cloudinary, Socket.io), local setup, environment variables, deployment links, demo credentials (one organizer and one sponsor from the seed), and a note on AI usage.

## 15. Definition of Done

- All five workflows in Section 7 work on the deployed app with seeded demo accounts.
- The four AI features work, and the app degrades gracefully when AI fails.
- Five required tests pass.
- No secrets in the repo or git history. Commit history shows incremental progress.
- README complete, demo video recorded (3 to 5 minutes), all links open in an incognito window, form submitted before 27 Oct 2026, 11:59 PM IST.
