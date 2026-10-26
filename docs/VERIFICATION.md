# Verification — October 25, 2026

This is a tested development build, not a claim of production security certification.

## Completed

- 20 domain tests: all roster sizes 2–128, byes, advancement, draws, forfeits, corrections, frozen archives, input validation, membership/role input boundaries, legal chess moves, turns, server clock math, correspondence deadlines, draw offers, checkmate, repetition, and all 3,865 opening lines.
- Firestore emulator access checks: owner/admin reads, private member/contact records, published-only queries, hidden/draft album metadata, verified-email and verified-phone admin requirements, participant-only games, private statistics, and denial of all direct client writes including admin writes.
- Integration test passed against local Auth and Firestore emulators by invoking callable handlers directly with verified emulator ID tokens. It exercised member applications/approval, rejection of non-admin approval, pending-member challenge denial, bracket generation and finalization, stale-revision rejection, album drafts, member challenge acceptance, turn and revision enforcement, resignation, head-to-head statistics, and idempotent practice saves.
- Browser checks: Babe's legal response to e4, opening recognition/narrowing, recording a completed practice result, matching opening suggestions, desktop and phone-width layout. Latest pieces match the supplied rounded Neo reference on the existing red and blue board.
- Production bundling completed successfully.

## Environment-limited checks

The Functions emulator HTTP runtime cannot bind its Unix socket in this workspace (`listen EPERM`); direct handler integration verifies business logic and transactions but does not replace a deployed HTTPS callable transport test. The full transport integration test is included for a normal development/CI environment.

Storage rules compile, but the local Storage emulator's cross-service requests to Firestore fail through the workspace proxy (`SocketError: other side closed`). Two positive upload/read tests therefore remain unverified here. The privacy checks were not weakened to make those tests pass. Run the complete suite outside this constrained runtime and verify real bucket upload/visibility before launch.

## Security design

Client Firestore writes are denied. Validated callables perform all member, tournament, photo metadata and game mutations. Verified phone sign-in now qualifies alongside verified email; supplying a phone field alone never grants access. Admin callables fetch current Auth role/verification state rather than trusting a form or local flag. Membership approval is stored server-side; online games require approved membership. Game turns, legality, revisions and time are checked server-side. Tournament revisions avoid accidental concurrent overwrites, and admin actions are recorded in an audit collection.

Private records are restricted to their owner, game participants, or verified admins as appropriate. Public albums and photos need explicit publication flags; newly uploaded photo metadata starts hidden. Image uploads require verified admin claims, an existing album, approved MIME types and size bounds. Originals cannot be overwritten. Public player display names should be used instead of publishing contact details.

Practice results are unrated. Client-side engines can be modified by users, so their results should never be treated as trusted tournament rankings. Membership approval is not an age-verification process; operators should obtain appropriate permission for minors' accounts and published photos.
