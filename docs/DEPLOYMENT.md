# GitHub and Firebase deployment

## Decisions still needed

- GitHub repository: https://github.com/theeray/hwchess (confirmed).
- Firebase account/project selection. Preferred Hosting site ID is `hwchess`; availability is unverified. Do not reuse the existing TAD projects.
- Owner selection of billing and database/storage location before provisioning. Cloud Functions and Storage may require billing; nothing has been enabled or charged by this build.
- Administrator activation for Eric, Yohan, and Dan Baston. Their identities must be verified in the selected Firebase project; personal contacts are intentionally not recorded in this public repository.

## Firebase setup

1. Authenticate using `npx -y firebase-tools@latest login` on a trusted machine. Never place credentials in source or chat.
2. Select the dedicated project explicitly with `--project PROJECT_ID`. Use Standard edition Cloud Firestore for this implementation. Confirm the production edition before running database operations; the local test database was Standard.
3. Enable email/password and Phone Authentication, choose password policy, configure the SMS region policy (United States for the initial club setup), and add the actual Hosting domains to authorized domains. Configure the verification/password-reset email sender and templates.
4. Create the web app and put its public Firebase config object in `public/firebase-config.js` as `window.HEADWATERS_FIREBASE = { ... };`. Client config is public; service-account credentials are not.
5. Enable the default Firestore database, Storage bucket, and Functions services in the chosen project. Functions are configured for `us-central1`. If a different region is chosen, update both backend options and `src/cloud.js`.
6. Keep Firestore/Storage access controlled by the included rules. Storage rules consult the parent Firestore album/photo documents. Enable the requested cross-service rules permission during deployment.
7. Configure the Storage bucket CORS policy for the actual Hosting origins using `docs/storage-cors.example.json`; replace origins if the final site name differs. The app uses authenticated blob reads, not public permanent download tokens.
8. Run the complete emulator suite and production build, then deploy rules, indexes, Functions, and Hosting to the explicit project:

```sh
npm ci
npm --prefix functions ci
npm test
npm run build
npx -y firebase-tools@latest deploy --project PROJECT_ID --only firestore,storage,functions,hosting
```

The checked-in `firebase.json` uses the selected project's default Hosting site. If `hwchess` is a secondary Hosting site in another project, configure an explicit Hosting target and map it to that site before deploying. Neither the hostname nor a project ID has been preselected in this source.

## Administrator setup

Eric's verified address is `eric.carlson.2@bemidjistate.edu`. Email administrators must register and verify their exact email addresses first. Phone administrators must sign in through the SMS code flow and submit a membership application first. No SMS is sent until the account holder requests a code and completes reCAPTCHA. Using Application Default Credentials for the chosen project, run:

```sh
node functions/bootstrap-admin.mjs PROJECT_ID eric.carlson.2@bemidjistate.edu
```

Repeat with each authorized administrator’s verified email or E.164 phone number (country code included). Keep the actual contact values out of source control. This script checks the registered account and disabled status before granting a custom admin claim. Email accounts need verified email. Phone accounts need a server-recorded membership application from a completed Firebase phone sign-in matching that exact number. It sends no invitation. Sign out and back in after granting the claim. Admins who also want to play member games should submit and approve their membership application.

## Launch acceptance

Before public launch, test two real non-admin accounts in a preview/staging environment: email verification, pending approval, admin review, member challenges, realtime moves, clocks and a completed result. Confirm a nonmember cannot read private games or member contact details. Test admin album uploads and published/hidden visibility against the deployed bucket, including CORS. Verify Eric, Yohan, and Dan’s access independently. Test phone sign-in on a real authorized HTTPS domain; local emulator tests do not send real SMS. Check all event details and obtain final approval for any additional sponsors.

## GitHub

The source is maintained at https://github.com/theeray/hwchess. `.github/workflows/verify.yml` runs unit tests, the build, and the complete Firebase emulator checks. There is no automatic deployment workflow and no embedded credential. Configure deployment only after the Firebase project is confirmed.
