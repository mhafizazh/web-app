# DECISIONS.md

Open questions / choices made while implementing the Eve web-app prototype from
`eve_mobile_app_build_spec.md`.

## Scope
- **Web prototype, Phase 1 focus.** Implemented as a browser-based web app in
  `web-app/` (not React Native/Flutter). The spec targets iOS/Android; this
  follows the requested direction to “make it in web app…” while matching the
  spec’s screens, flows, design tokens, and demo behavior.
- **No real Garmin/watch/backend integrations in this prototype.** Phase 1
  acceptance is satisfied with seed data and a **Simulate watch** developer
  menu. Auth, Connect IQ bridge, Health API, PostgreSQL/PostGIS, push
  notifications, and production sync are stubbed/local-only where relevant.

## Platform & architecture
- **Stack:** dependency-free Node.js static server + vanilla HTML/CSS/JS
  (ES modules). No build step, no npm install required (`npm start`).
- **Persistence:** `localStorage` for theme, onboarding-complete flag, simulated
  moments/edits, helpful/thanks toggles, and simple settings. Seed data is
  loaded from `public/seed.js`.
- **State:** client-side state derived from seed data plus simulated events;
  computed locally (clustering/summary/insights/story) as specified.

## Map & location
- **Map rendering:** stylized schematic/SVG map of Calgary-style streets and
  places (no external Mapbox/Google Maps API key required for the prototype).
  Pins, routes, and flagged zones are positioned on this map to match seed data.
  This keeps the demo runnable offline/out-of-the-box; swapping to a real map SDK
  is straightforward later.
- **Geocoding/routing:** mocked for seed places/routes and the calmer-route flow
  (predefined usual vs calmer route polylines and reasons) consistent with spec
  examples.

## Seed data
- **User:** Jane, Calgary context, watch connected.
- **Week/Month demo:** includes 71 moments in the current week (29 good, 38 bad,
  4 unsafe) plus month data sufficient for summaries, “When they happened”,
  Moments/Safety views, and the 5-chapter Story. Counts/labels follow spec
  examples where given (e.g. *“Walk home from the office · 3 unsafe moments · all
  after 8 pm”*, *“12 women flagged…”*).
- **Dates anchored to spec date context** (Nov 14, 2026) so relative labels like
  “this week/month” and sample timestamps are coherent.

## UI/UX details (simplest choices where unspecified)
- **Onboarding:** implemented as a first-launch flow with the required steps;
  can be completed quickly for demo and is persisted so it doesn’t repeat.
  Account creation/pairing/permissions are simulated confirmations.
- **Simulate watch menu:** in-app developer panel/button to emit fake `spike`,
  `tag`, and `share_decision` messages (and unsafe reasons), driving the same
  client-side handling as W2–W4.
- **Place clustering:** moments within 75 m grouped into a place (per spec);
  pin shows count and majority type (unsafe wins).
- **Insights/story text:** rule/template-based from local/seed data using the
  spec’s kind tone. No LLM calls.
- **Calmer route:** shows the two routes and comparison cards per spec; “Guide me
  on watch” and “Share with a friend” produce in-app confirmations (no real
  device/share integrations).
- **Community feed:** seeded spots near Jane with Helpful/Say thanks toggles and
  preset thank-you notes only (no free text), per spec.
- **Accessibility:** color + shape for moment types, labels/aria where
  applicable, 44px+ targets, readable contrast, and reduced-motion-friendly
  transitions kept minimal.

## Out of scope for this prototype
- Real Connect IQ watch app messaging, Garmin Health API, background monitoring.
- Real authentication, backend/PostGIS, k-anonymity enforcement server-side,
  encrypted-at-rest storage, export/delete server operations (UI entries shown
  per Me tab; actions are local/demo confirmations where backend is absent).
- Native map tiles/directions SDK integration (requires keys); schematic map used
  instead.
