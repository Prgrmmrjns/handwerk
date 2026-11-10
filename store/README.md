# Handwerk — Google Play Store kit

Assets and copy for the Play Console listing. App ID: `io.github.prgrmmrjns.handwerk`.

## Category recommendation

**Primary: Education**

Handwerk is an interactive anatomy / injury teaching tool from a personal scaphoid-fracture story. It is **not** a diagnostic or clinical decision app and is **not** a medical device. Prefer **Education** over **Medical** so Play reviewers and users do not expect regulated clinical software. Optional secondary: Medical only if Console requires a second category and Education is already primary — still keep the listing disclaimer prominent.

## Content rating (IARC questionnaire notes)

Fill **Policy → App content → Content ratings**. Suggested answers for this build:

| Topic | Note |
| --- | --- |
| Violence | No real violence; stylized bone injury teaching graphics only → treat as educational / non-violent |
| Sexual content | None |
| Language | None (medical anatomy terms only) |
| Controlled substances | None |
| User-generated content / chat | No social features; optional typed scene prompts are not a public UGC feed |
| Account / in-app purchases | None |
| Sharing location | No |
| Target audience | Adults / medical students / clinicians in training; not directed at children under 13 |

Expect a low rating (Everyone / PEGI 3-class equivalent). Attach the privacy URL when asked.

## Listing files

| Path | Use |
| --- | --- |
| `metadata/android/en-US/` | English title, short, full description |
| `metadata/android/de-DE/` | German title, short, full description |
| `graphics/icon-512.png` | High-res icon 512×512 |
| `graphics/feature-graphic-1024x500.png` | Feature graphic |
| `screenshots/phone/` | Phone screenshots (9:16) |
| `DATA_SAFETY.md` | Data safety form answers |

Character limits: title ≤ 30, short description ≤ 80, full description ≤ 4000.

## Signing secrets (GitHub → repo Settings → Secrets and variables → Actions)

When these four exist, Android CI builds a signed **release AAB** + **release APK**, uploads artifacts, and attaches them to a GitHub Release. When any are missing, CI falls back to the debug APK so the workflow stays green.

1. `ANDROID_KEYSTORE_BASE64` — base64 of the upload `.jks` / `.keystore` (from `scripts/make-keystore.sh`)
2. `ANDROID_KEYSTORE_PASSWORD`
3. `ANDROID_KEY_ALIAS`
4. `ANDROID_KEY_PASSWORD`

Never commit the keystore. Local generation only:

```bash
./scripts/make-keystore.sh
```

## Versioning

- `versionName` is set in `android/app/build.gradle` (bump manually for store releases, e.g. `1.0.0` → `1.0.1`).
- `versionCode` uses `GITHUB_RUN_NUMBER` in CI when present; otherwise the Gradle default. Each Play upload needs a higher `versionCode` than the previous.

## Play-required targetSdk

This project targets the current Play requirement (**API 36**). Keep `compileSdk` / `targetSdk` aligned when Google raises the floor again.

---

## Upload checklist for Jonas (do not skip closed testing)

New personal Play developer accounts must run a **closed test with at least 12 testers for 14 days** before production. Do **not** ask the agent to merge or publish.

### A. One-time account & console

1. Open [Google Play Console](https://play.google.com/console) and create / select the developer account.
2. Create app → name **Handwerk**, default language **English (United States)**, app type **App**, Free.
3. Complete **Declarations** (ads: No; COVID / news / etc. as applicable: No).
4. Set **App category** → **Education** (see above).
5. Link **Privacy policy**: `https://handwerk-ruddy.vercel.app/privacy`.
6. Complete **Data safety** using `DATA_SAFETY.md`.
7. Complete **Content ratings** using the notes above.
8. Complete **Target audience**, **News apps**, **COVID**, **Data protection**, and store listing contact fields.

### B. Play App Signing + upload key

1. In Play Console → **Setup → App signing**, enroll in **Play App Signing** (recommended / required for new apps).
2. Generate a **local upload keystore** with `./scripts/make-keystore.sh` (not in CI). Save the `.jks` offline and the printed base64.
3. Add the four GitHub Actions secrets listed above.
4. Re-run the Android workflow (or push a tag) so CI produces a **signed** `app-release.aab` + `app-release.apk` and attaches them to a GitHub Release.
5. Download the **AAB** from the workflow artifacts or the GitHub Release. Upload that AAB to Play (Play re-signs with the app signing key; you keep the upload key).

### C. Store listing assets

1. **Main store listing** → upload `graphics/icon-512.png` and `graphics/feature-graphic-1024x500.png`.
2. Add phone screenshots from `screenshots/phone/` (at least 4).
3. Paste `en-US` title / short / full from `metadata/android/en-US/`.
4. Add German locale and paste `de-DE` files.
5. Short / full text must stay honest: educational, non-diagnostic, personal scaphoid story — no “AI doctor” claims.

### D. Closed testing (12 testers × 14 days)

1. **Testing → Closed testing** → create a track (e.g. `closed-alpha`).
2. Create a release → upload the **signed AAB** → review release notes → save.
3. Create an email list (or Google Group) with **≥ 12 testers** who accept the invite and install from the opt-in link.
4. Keep the closed test active for **≥ 14 days** with those testers enrolled (Play’s requirement for new personal accounts).
5. Monitor pre-launch report / crashes; fix and upload a higher `versionCode` AAB if needed.

### E. Production (only after closed test clears)

1. Apply for production access when Console allows it after the closed-test window.
2. Promote the closed release or create a production release with the same AAB family.
3. Submit for review. Do not remove the educational / non-diagnostic disclaimer.

### F. After each store update

1. Bump `versionName` in Gradle; let CI raise `versionCode` (or bump manually).
2. Ensure all four signing secrets still work.
3. Refresh screenshots if UI changed (especially annotation cards).
4. Keep `/privacy` and `DATA_SAFETY.md` in sync if networking behavior changes.
