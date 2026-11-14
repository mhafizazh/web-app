# Eve Web App (Prototype)

Phase 1 web prototype of **Eve** — *“Live fully. Eve has your back.”* — built
from `../eve_mobile_app_build_spec.md`. This implements the phone app
experience as a browser-based web app (demo-ready, no real watch/backend
required).

## Run

```sh
npm start
```

Open <http://localhost:3000>.

No `npm install` required (Node.js built-ins only). Node 18+ recommended.

## What’s included (Phase 1 demo)

- **Themes:** Light | Berry toggle (Home header and Me → Look), design tokens
  and neumorphic components per spec.
- **Onboarding:** first-launch flow (welcome, account, pair watch, permissions,
  privacy, optional friends/cycle insights, look).
- **Tabs:** Map, Moments, Safety, Me with bottom navigation.
- **Map:** Day/Week/Month range, schematic Calgary-style map, pins by
  place/type (circle good/bad, diamond unsafe), filters, community toggle,
  summary and “When they happened”.
- **Moments:** All/Good/Bad/Unsafe tabs, dynamic insight, place cards, unsafe
  “See a calmer route”, place detail.
- **Safety:** routes with unsafe moments, “Your shares are helping”, “Shared by
  women near you” with Helpful/Say thanks (preset notes).
- **Calmer Route:** alert, route comparison, reasons, actions.
- **Me:** profile, 5-chapter Story, “How you’ve been feeling”, Profile & privacy
  list.
- **Simulate watch:** developer menu to send fake `spike`, `tag`, and
  `share_decision` messages (drives the core loop on seed data).

## Seed data

Demo data for **Jane** in a Calgary-style context (including 71 moments this
week: 29 good, 38 bad, 4 unsafe) is defined in `public/seed.js`.

## Notes

- Prototype runs fully client-side with `localStorage` for demo state; see
  `DECISIONS.md` for implementation choices (schematic map instead of external
  map SDK keys, simulated onboarding/auth/community, etc.).
- Served as a responsive web app suitable for phone-sized screens.
