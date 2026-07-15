# Sakthi

Sakthi is a personal safety and emergency response project with a Django backend and a React Native mobile app. It supports SOS alerts, emergency contacts, live location tracking, community safety reports, safe-route analysis, Google sign-in, Firebase push notifications, and optional SMS delivery through Twilio.

## Project Structure

```text
sakthi/
├── .github/
│   └── workflows/
│       └── keep-warm.yml          # GitHub Action that keeps the Render backend awake
├── accounts/                      # Main Django app
│   ├── api/                       # Django REST Framework serializers, views, and API URLs
│   ├── management/commands/       # Custom Django management commands
│   ├── migrations/                # Database migrations
│   ├── services/                  # SOS, location, AI, safety, and FCM business logic
│   ├── forms.py                   # Web forms for auth, contacts, profile, and reports
│   ├── models.py                  # CustomUser, SOSAlert, contacts, reports, tracking models
│   ├── urls.py                    # Server-rendered web routes
│   └── views.py                   # Django web views
├── authproject/                   # Django project configuration
│   ├── settings.py                # Installed apps, database, auth, REST, media, integrations
│   ├── urls.py                    # Root URL routing
│   └── wsgi.py                    # WSGI entry point for deployment
├── media/                         # Local uploaded media during development
├── static/                        # Static assets
├── templates/                     # Django HTML templates
│   └── accounts/                  # Web pages for login, dashboard, tracking, reports, etc.
├── SakthiMobile/                  # React Native mobile app
│   ├── android/                   # Android native project and Gradle config
│   ├── ios/                       # iOS native project
│   ├── src/
│   │   ├── components/            # Shared React Native UI components
│   │   ├── config/                # API base URL and OAuth client config
│   │   ├── context/               # Auth context and token persistence
│   │   ├── navigation/            # App navigation
│   │   ├── screens/               # Mobile app screens
│   │   └── services/              # API, FCM, offline SOS, and helper services
│   ├── App.js                     # Mobile app root component
│   └── package.json               # Mobile dependencies and scripts
├── manage.py                      # Django command-line entry point
├── requirements.txt               # Backend Python dependencies
├── render.yaml                    # Render backend deployment blueprint
└── README.md                      # Project documentation
```

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
