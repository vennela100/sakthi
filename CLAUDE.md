# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

This repo contains **two independent applications** that talk to each other:

1. **Django backend** (repo root) — project `authproject`, single app `accounts`. It serves **both** a server-rendered web app (`templates/`) **and** a JSON REST API (`accounts/api/`) consumed by the mobile app.
2. **React Native mobile app** (`SakthiMobile/`) — Android-focused personal-safety app ("Sakthi") that hits the Django REST API.

The product is a women's-safety / SOS app: emergency SOS (SMS + live location + evidence), live tracking, safe-route analysis, community danger reports, voice-triggered SOS, and an AI safety assistant.

## Backend (Django)

- **Django 4.2.7, SQLite** (`db.sqlite3`), custom user model `accounts.CustomUser` (`AUTH_USER_MODEL`). There is no requirements file — dependencies live in the active virtualenv (DRF, `rest_framework_simplejwt`, `django-allauth`, `google-auth`, `twilio`, `firebase-admin`).
- **Two URL surfaces, one app:**
  - `accounts/urls.py` → server-rendered web views (templates in `templates/accounts/`). Mounted at `/`.
  - `accounts/api/urls.py` → DRF ViewSets + APIViews + SimpleJWT. Mounted at **`/api/v1/`** (see `authproject/urls.py`). The mobile app uses only this surface.
- **Auth:** mobile uses SimpleJWT — `POST /api/v1/token/` (username **or** email + password, via `EmailOrUsernameTokenObtainPairView`), `/token/refresh/`, and `/auth/google/` (verifies a Google ID token with `google-auth` and returns the same JWT pair). The web app uses `django-allauth` Google OAuth. Accepted Google audiences are in `settings.GOOGLE_OAUTH_CLIENT_IDS`.
- **Architecture pattern — fat services, thin views:** all real logic lives in `accounts/services/` (`SOSService`, `LocationService`, `AIService`, `SafetyService`, `FCMService`). Both the API views (`accounts/api/views.py`) and web views (`accounts/views.py`) delegate to these. When changing behavior, edit the service, not the view.
- **Models** (`accounts/models.py`): `CustomUser`, `SOSAlert`, `EmergencyContact`, `SafetyZone`, `CommunityReport`, `LocationHistory`, `TrackingSession`, `DangerZone`.
- **External integrations** (keys loaded from environment variables in `authproject/settings.py`): Twilio (SOS SMS), Google Gemini (`AIService` route/safety analysis), Google Maps, Firebase Cloud Messaging (push via `serviceAccountKey.json` -> `FCMService`). Tracking links use UUID tokens (`TrackingSession`) for public/third-party access.

### Backend commands
```bash
python manage.py runserver 127.0.0.1:8000   # dev server the mobile app expects
python manage.py migrate
python manage.py check                        # fast validation after edits
python manage.py createsuperuser
```
The root `test_*.py` files (`test_apis.py`, `test_analyze_route.py`, `test_api_key_injection.py`) are **standalone scripts**, not a test-runner suite — each calls `django.setup()` itself. Run one with `python test_apis.py`. `insert_and_test_reports.py` seeds report data.

## Mobile (SakthiMobile/)

- **React Native 0.85, React 19, New Architecture (mandatory — cannot be disabled).** Navigation in `src/navigation/AppNavigator.js` (bottom tabs: Home/Track/Route/Voice/More; More is a nested stack). Screens in `src/screens/`.
- **Design system:** `src/theme.js` (tokens: `colors`, `spacing`, `radius`, `font`, `type`, `tracking`, `shadow`) + `src/components/Premium.js` (shared `PremiumCard`, `ActionTile`, `PrimaryButton`, `Field`, `IconMark`, etc.). Icons in `IconMark` are hand-built from `<View>`s, not an icon font.
  - **Only `Inter-Regular` and `Inter-Bold` are bundled.** `theme.font` maps every weight (medium/semibold/black) to `Inter-Bold`. **Always style text with `fontFamily: font.*`, never bare `fontWeight`** — a bare `fontWeight` silently renders the system font (Roboto) and breaks typographic consistency.
- **Auth/data flow:** `src/context/AuthContext.js` (login / googleLogin / logout, token persistence in AsyncStorage, silent refresh, FCM registration) → `src/services/ApiService.js` (single axios instance, JWT bearer header). Backend base URL in `src/config/api.js` = `http://127.0.0.1:8000/api/v1`, reached over USB via `adb reverse tcp:8000 tcp:8000`. `GOOGLE_WEB_CLIENT_ID` there must match `settings.GOOGLE_OAUTH_CLIENT_IDS`.
- **Native Kotlin modules** (`android/app/src/main/java/com/sakthimobile/`): `RiskCamera` (silent evidence capture), `VoiceRecognition` (voice-trigger SOS), `PowerButtonTrigger`, `SafetySpeech` (TTS route guidance). Accessed via `NativeModules` in the screens.
- **Offline SOS:** `src/services/OfflineSOSService.js` sends SMS directly even without connectivity.
- Entry point is **`App.js`** (not the default-template `App.tsx`, which is unused). `index.js` registers it and the FCM background handler.

### Mobile commands (run inside `SakthiMobile/`)
```bash
npm start                    # Metro
npm run android              # debug build + install (needs Metro running)
npm run lint                 # eslint
npm test                     # jest
npm run bundle:android       # produce a standalone JS bundle into android assets
npm run android:release-apk  # gradlew assembleRelease
```
The release `buildType` is signed with the **debug keystore**, so `app-release.apk` installs directly on a device for testing.

## Building the release APK on this machine (Windows + OneDrive) — important

The project lives at a deep OneDrive path, which breaks a normal release build two ways; a plain `gradlew assembleRelease` will fail. Working recipe:

1. **`MAX_PATH` (260 char) in the C++ codegen** → build from a short virtual drive: `subst X: "<project>\SakthiMobile"`, then build from `X:\android` (a 3-char root just fits; `C:\sm` does not).
2. **Metro "Failed to get SHA-1"** under that subst drive → don't let Gradle bundle JS. Instead pre-bundle from the **real** path (`npm run bundle:android` / the `react-native bundle` command), which writes `android/app/src/main/assets/index.android.bundle` + assets into `src/main/res`.
3. Build from `X:\android` with an init script that disables the bundle task (do **not** use `gradle -x` — it breaks `mapReleaseSourceSetPaths`):
   ```
   gradle.taskGraph.whenReady { g -> g.allTasks.findAll { it.name == 'createBundleReleaseJsAndAssets' }*.enabled = false }
   ```
   `.\gradlew.bat assembleRelease --init-script <that-script> --no-daemon`

Regenerate the JS bundle (step 2) after **any** JS change before rebuilding. Output: `android/app/build/outputs/apk/release/app-release.apk`. The permanent fix is to move the project off OneDrive to a short path.

## Google Sign-In setup (mobile)

The app + backend are wired to the project's **Web** OAuth client id (`settings.GOOGLE_OAUTH_WEB_CLIENT_ID`, mirrored in `src/config/api.js`). For native sign-in to authenticate (avoid `DEVELOPER_ERROR`), the Google Cloud project must also have an **Android** OAuth client for package `com.sakthimobile` + the signing key's SHA-1 (debug keystore SHA-1, since release is debug-signed). Get the SHA-1 with `keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android`.
