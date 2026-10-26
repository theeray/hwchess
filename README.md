# Headwaters Chess Club

A working website and chess application for the Bemidji club, maintained in [theeray/hwchess](https://github.com/theeray/hwchess) and prepared for classic Firebase Hosting. Intended hosting name: **hwchess.web.app**. That name has not been reserved or verified as available.

## Current state

The local website, computer chess, live opening guide, browser-session dashboard, photos, and bracket demo work without a Firebase connection. Real account registration, member play, administrator controls, and persistent records are implemented but intentionally unavailable until `public/firebase-config.js` is configured and the backend is deployed. No real accounts or administrator roles have been created. The source is maintained in this repository; no public Firebase deployment has been created.

## Included

- Babe the Blue Knight branding; red and blue chessboards with the rounded traditional pieces requested in the latest reference.
- Sundays 1:30–3:30 pm, led by Dan Batson at Headwaters Performance Hall; equipment provided and all levels welcome.
- November 22, 2026 tournament, 1–5 pm Central, with a calendar download. Entry fees and tournament time controls remain unannounced.
- TAD website sponsorship and Headwaters space sponsorship. Watermark is held pending approval.
- User-supplied club photos, sponsor logos, and links to club news and Region 2 Arts Council.
- Email/password or SMS-code accounts, verified-identity applications, administrator approval, and private membership records.
- Per-division randomized single-elimination brackets for 2–128 entrants; automatic byes/advancement; draws replayed with colors switched; forfeits; correction/reset of affected later matches; CSV export, print, and finalized statistics.
- Administrator albums with retained originals, optimized previews, captions, alt text, ordering, and separate album/photo visibility. Newly uploaded photos start hidden.
- Stockfish opponents: Babe easy, Lucette intermediate, Paul advanced. Legal moves, promotion, castling, en passant, checkmate and draws.
- 3,865 named opening lines from Lichess. Possibilities narrow by move sequence; recognized transpositions and out-of-book positions are identified.
- Approved-member challenges: blitz 3+2, rapid 10+5, untimed, or 14 days **per move**. Server-validated moves and clocks, realtime game views, draw offers and resignation.
- Member and computer statistics kept separately; head-to-head records; PGN downloads; opening suggestions and step-through lessons based on first moves.

## Run locally

Use Node 22 for parity with the Functions runtime. Java 21 is needed for current Firebase emulators.

```sh
npm ci
npm --prefix functions ci
npm run dev
```

Run `npm test` for domain tests and `npm run build` for the static build. A managed preview can use the root Vite project. For server tests:

```sh
npx -y firebase-tools@latest emulators:exec --project demo-headwaters --only auth,firestore,storage,functions 'node --test tests/rules.test.js && node --test functions/integration.test.mjs'
```

See [verification](docs/VERIFICATION.md) for completed checks and environment limitations, [deployment](docs/DEPLOYMENT.md) for setup, and [assets](docs/ASSETS.md) for provenance.

## Practical limits

This version uses single elimination, not Swiss pairings. Correspondence is 14 days per move. Challenges appear inside the app; email/push reminders are not enabled. A timeout is settled when a player submits a move or checks timeout. Computer results are self-reported, validated as finished legal games, and explicitly unrated. Opening suggestions are repertoire suggestions, not a full engine analysis or mistake review. Browser-only history lasts for the current browser session; approved members can sync completed games. Administrative list views are currently bounded to 300 records and album views to 500 photos.
