# Sakthi

Sakthi is a personal safety and emergency response project with a Django backend and a React Native mobile app. It supports SOS alerts, emergency contacts, live location tracking, community safety reports, safe-route analysis, Google sign-in, Firebase push notifications, and optional SMS delivery through Twilio.

## Project Structure

- `authproject/` - Django project settings and root URL configuration.
- `accounts/` - Django app for users, SOS events, contacts, reports, tracking, REST APIs, and service-layer logic.
- `templates/` - Server-rendered Django pages for the web experience.
- `static/` and `media/` - Static assets and local media uploads.
- `SakthiMobile/` - React Native mobile app that consumes the Django REST API.
- `.github/workflows/keep-warm.yml` - Scheduled GitHub Action that pings the deployed backend.
- `render.yaml` - Render deployment blueprint for the backend.

## Main Features

- User registration and login with username/email and password.
- JWT API authentication for the mobile app.
- Google OAuth support for web and mobile sign-in.
- SOS alert creation with location and optional media evidence.
- Emergency contact management.
- Live location tracking through secure tracking-session tokens.
- Community danger/safety reports.
- Safe-route and AI safety assistant endpoints.
- Firebase Cloud Messaging device token registration.
- Optional Twilio SMS notification support.

## Backend Setup

Create a virtual environment, install dependencies, run migrations, and start Django:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

Copy `.env.example` into your environment configuration and fill only the integrations you need:

```text
DJANGO_SECRET_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
GOOGLE_OAUTH_WEB_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_IDS=
GOOGLE_OAUTH_CLIENT_SECRET=
GEMINI_API_KEY=
GOOGLE_MAPS_API_KEY=
```

Useful backend commands:

```bash
python manage.py check
python manage.py test
python manage.py createsuperuser
```

## API Overview

The mobile API is mounted under:

```text
/api/v1/
```

Common endpoints include:

- `GET /api/v1/health/`
- `POST /api/v1/register/`
- `POST /api/v1/token/`
- `POST /api/v1/token/refresh/`
- `POST /api/v1/auth/google/`
- `GET /api/v1/profile/`
- `POST /api/v1/trigger-sos/`
- `POST /api/v1/update-location/`
- `GET /api/v1/contacts/`
- `GET /api/v1/community-reports/`

## Mobile App Setup

Install dependencies and run the app from the mobile directory:

```bash
cd SakthiMobile
npm install
npm start
npm run android
```

The mobile backend URL is configured in:

```text
SakthiMobile/src/config/api.js
```

For local Android device testing against `127.0.0.1:8000`, use:

```bash
adb reverse tcp:8000 tcp:8000
```

## Deployment

The backend is configured for Render with `render.yaml`. Production environment variables should be set in Render, including database, Django secret, OAuth, Twilio, Gemini, Google Maps, Firebase, and optional Cloudinary settings.

The keep-warm workflow pings the Render backend every 5 hours and keeps the service awake by looping within each run.

## Notes

- The backend uses SQLite locally and can use `DATABASE_URL` in production.
- Uploaded SOS evidence can be stored locally for development or on Cloudinary when `CLOUDINARY_URL` is configured.
- Do not commit real secret keys, OAuth secrets, Firebase service account JSON, or production database URLs.
