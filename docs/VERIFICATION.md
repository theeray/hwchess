# Verification — October 25, 2026

This is a tested development build, not a claim of production security certification.

## Completed

The full [GitHub Actions verification run](https://github.com/theeray/hwchess/actions/runs/40248982203) passed for commit `b27fb4e86afbf2041d714db77b0d422bfc7be8d0`: 20 domain tests, 8 access-rule tests, the full HTTPS callable integration test, and the production build.

- 20 domain tests: all roster sizes 2–128, byes, advancement, draws, forfeits, corrections, frozen archives, input validation, membership/role input boundaries, legal chess moves, turns, server clock math, correspondence deadlines, draw offers, checkmate, repetition, and all 3,865 opening lines.
- Firestore emulator access checks: owner/admin reads, private member/contact records, published-only queries, hidden/draft album metadata, verified-email and verified-phone admin requirements, participant-only games, private statistics, and denial of all direct client writes including admin writes.
- Integration test passed against local Auth and Firestore emulators by invoking callable handlers directly with verified emulator ID tokens. It exercised member applications/approval, rejection of non-admin approval, pending-member challenge denial, bracket generation and finalization, stale-revision rejection, album drafts, member challenge acceptance, turn and revision enforcement, resignation, head-to-head statistics, and idempotent practice saves.
- Browser checks: Babe's legal response to e4, opening recognition/narrowing, recording a completed practice result, matching opening suggestions, desktop and phone-width layout. Latest pieces match the supplied rounded Neo reference on the existing red and blue board.
- Production bundling completed successfully.

## Verification scope

The workspace blocked the Functions emulator Unix socket and Storage-to-Firestore requests, so the full suite was run successfully on GitHub's runner. This covered the real HTTPS callable wrapper, email and emulated SMS sign-in, admin-role enforcement, both same-content and changed-content photo overwrite rejection, and published/hidden photo access. The overwrite rule explicitly requires `resource == null`; updates and deletion are denied.

Production Firebase services are not connected or deployed. Real SMS delivery, email delivery, bucket CORS, and final account roles still require acceptance checks in the chosen Firebase project. No real admin roles have been granted yet, and no SMS was sent to a real phone during testing.

## Security design

Client Firestore writes are denied. Validated callables perform all member, tournament, photo metadata and game mutations. Verified phone sign-in now qualifies alongside verified email; supplying a phone field alone never grants access. Admin callables fetch current Auth role/verification state rather than trusting a form or local flag. Membership approval is stored server-side; online games require approved membership. Game turns, legality, revisions and time are checked server-side. Tournament revisions avoid accidental concurrent overwrites, and admin actions are recorded in an audit collection.

Private records are restricted to their owner, game participants, or verified admins as appropriate. Public albums and photos need explicit publication flags; newly uploaded photo metadata starts hidden. Image uploads require verified admin claims, an existing album, approved MIME types and size bounds. Originals cannot be overwritten. Public player display names should be used instead of publishing contact details.

Practice results are unrated. Client-side engines can be modified by users, so their results should never be treated as trusted tournament rankings. Membership approval is not an age-verification process; operators should obtain appropriate permission for minors' accounts and published photos.
