# TutorMatcher — HTML Prototype

A clickable, no-backend prototype of the product. 17 HTML pages, one shared stylesheet,
one shared script. Open it and use it: log in, browse tutors, build a booking slot by
slot, add friends to a lesson, watch it move through friend-invites → tutor confirmation →
payment, pay from a wallet, and top that wallet up with a (fake) PromptPay QR. Every
screen shows, in the dark bar up top, what URL it would be on the real site.

Two things persist in your browser's `localStorage`: the **wallet balance** and whether
you're **logged in**. Everything else — messages, bookings, reviews — resets on reload.
It's a UI prototype for click-testing flows and layout, not a working app.

## File structure

```
prototype/
├─ index.html                    → /                    minimal home (hero + Find a tutor / Become a tutor)
├─ login.html                    → /(auth)/login        one flag → the app pages open
├─ enroll-tutor.html             → /(auth)/enroll-tutor apply to be a tutor: upload docs → pending → approved
├─ admin.html                    → /admin/tutor-requests prototype console — approve your own tutor request
├─ search.html                   → /search
├─ tutor-detail.html             → /tutors/:id
├─ dashboard-student.html        → /dashboard           full-width Student ⇄ Tutor switch
├─ dashboard-tutor.html          → /dashboard/tutor    TUTORS ONLY · requests, schedule, availability editor
├─ booking-detail.html           → /bookings/:id        one booking: draft, then its status
├─ bookings.html                 → /bookings            all your bookings — tabs: All / Upcoming / Pending / Invites / Past
├─ payment-detail.html           → /payments/:id        pay a lesson from your wallet (no QR)
├─ topup.html                    → /topup               add real money to the wallet (QR)
├─ messages.html                 → /messages/:id        fills the viewport, no page scroll; Student ⇄ Tutor switch
├─ settings-account.html         → /settings/account
├─ settings-notifications.html   → /settings/notifications
├─ settings-tutor.html           → /settings/tutor      public tutor listing (bio, rate, subjects, verification)
├─ settings-wallet.html          → /settings/wallet     balance + "reset to ฿250"
├─ earnings.html                 → /earnings
├─ reviews.html                  → /reviews/:tutorId    read-only list (writing lives on a completed booking)
├─ _shared.css                   → design tokens + every component style
└─ _app.js                       → shared behaviour (auth, wallet, toasts, tabs, chat, pickers…)
```

No build step, no dependencies. Open `index.html` directly, or serve the folder
(`python3 -m http.server`, VS Code Live Server, etc.).

## Shell: one header, login/logout, and the role switch

- **Every page uses the same header component**: brand · `Dashboard · Find tutors ·
  Bookings · Messages` · then either **Log in / Sign up** (logged out) or the **wallet
  pill + avatar menu** (logged in, with Settings / Top up / Admin / Log out). The logo
  always goes to `/`.
- **Account state** — two `localStorage` keys, both cleared on **Log out** (so a fresh
  login is a brand-new account):
  - `tm_auth` — `''` logged out · `'user'` logged in. Everyone logs in as a plain student.
  - `tm_tutor` — `''` not a tutor · `'pending'` applied, awaiting admin · `'approved'` tutor.
- **Becoming a tutor**: "Become a tutor" → `/(auth)/enroll-tutor` → upload ID +
  certification, add a bio and subjects → **submit** (`tm_tutor = pending`). While pending
  you can re-open that page to **cancel & re-submit**. `/admin/tutor-requests` shows the
  one request with **Approve / Reject**; approving sets `tm_tutor = approved`. After that,
  `/(auth)/enroll-tutor` just redirects to `/dashboard/tutor`.
- **Route guards** (`_app.js`, run before render):
  - `data-requires-auth` → logged out ⇒ `login.html?next=…`
  - `data-requires-tutor` (on `/dashboard/tutor`, `/settings/tutor`) → not approved ⇒ `enroll-tutor.html`
  - `data-redirect-if-tutor` (on `enroll-tutor`) → already a tutor ⇒ `/dashboard/tutor`
  - until you're approved, every "tutor" link on the page is rewritten to `enroll-tutor.html`.
- The **Student ⇄ Tutor switch** navigates between `/dashboard` and `/dashboard/tutor`
  (non-tutors land on the application). On messages the same switch flips which side you're
  chatting as without leaving the page.
- Unread messages put a red dot on the Messages nav link (every page except that one).

## The booking flow

`Book a lesson` on a tutor profile **creates a draft immediately** and opens
`/bookings/:id` (not `/bookings`). From there:

1. **Draft** — a **month calendar** (‹ › to change month, up to 3 months out) shows a dot
   on days the tutor has free; pick one, then tap **back-to-back** hourly slots.
   Non-adjacent slots are rejected; there's no weekly option — one booking is one
   continuous block. Add a note, and optionally add friends.
2. **Friend invites** — if you added friends, the request waits until every friend
   accepts, then it automatically moves to the tutor.
3. **Pending tutor** — the tutor accepts or declines.
4. **Payment due** — once accepted, you pay. `/payments/:id` deducts straight from your
   **wallet balance** — no card, no QR here.
5. **Confirmed** — paid; the lesson is locked in.
6. **Completed** — after the lesson, this is the **only place to write a review** (star
   rating + comment, posts to the tutor's profile). `/reviews/:tutorId` is a read-only
   list; `/tutors/:id` shows recent reviews with a link back here to write one.

`booking-detail.html` renders whichever state is in `?s=` (`draft` default); a
"jump to state" selector on the page lets you preview each one. The `/bookings` list links
each row to the right state.

`/bookings` tabs (combined where it made sense):

| Tab      | Contains                                                                  |
| -------- | ------------------------------------------------------------------------- |
| All      | every booking, any status                                                |
| Upcoming | confirmed, paid lessons                                                   |
| Pending  | drafts + "pending tutor" + "waiting on friends I invited"                 |
| Invites  | group-lesson invites other people sent to you — accept / decline         |
| Past     | completed lessons + declined requests                                    |

## The wallet

Real money only enters at **`/topup`**: choose an amount, scan the PromptPay QR,
confirm — the balance goes up (and is saved to `localStorage`). Lesson payments at
`/payments/:id` spend that balance; if it's short, the page sends you to `/topup` for the
difference and back. `/settings/wallet` has a "reset to ฿250" button.

## What's real vs. fake

- **Design/layout**: real. `_shared.css` holds the tokens (teal `#0F6E56` / deep teal
  `#0B2B22` on cream, Fraunces headings, Inter body) and every component.
- **Content**: real-looking placeholder data, hard-coded in the HTML.
- **Interactions**: real but client-side. The calendar/slot picker enforces adjacency and
  prices the lesson; friend chips add/remove; the booking state machine advances; wallet
  top-up and lesson payment move a real (localStorage) number; filters filter; chat
  appends bubbles; forms toast instead of submitting.
- **Login/role**: a `localStorage` flag, not real auth — no password is checked and the
  role switch just picks which dashboard / chat side you see. But the flag does gate the
  app pages (logged out → bounced to `login.html`), and logout clears it.
- **Dynamic routes**: still flat — one `booking-detail.html`, one `tutor-detail.html`,
  etc. State comes from `?s=` / `?as=` / `?amt=` / `?next=` query params.
- **Backend, real payments, validation, notifications, persistence** (beyond the wallet
  number): none.

## Taking this to real pages

The other docs in this project are the source of truth for scope and shape:

1. **`backlog.yaml`** — user stories + acceptance criteria.
2. **`tutor-matcher-fullstack-map.md`** — API table, request/response shapes, Prisma
   schema.

Per page, "making it real" means: swap the hard-coded data for `fetch` calls against the
fullstack-map's endpoints; give the dynamic routes a real `:id`; replace `_app.js`'s fake
handlers (wallet math, state jumps, fake QR, toast-on-submit) with real requests, a
payment provider for top-ups, and websocket/polling for booking status and chat; and add
the auth/role checks the "Access" text only describes today. Do it one page at a time,
following the "Feature module structure" section of the fullstack-map.
