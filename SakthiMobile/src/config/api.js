// USB debug build: adb reverse maps the phone's localhost:8000 to the PC backend.
export const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

// Google OAuth Web client id (must match the audience the Django backend accepts
// in /api/v1/auth/google/). This is the project's OAuth 2.0 *Web* client id.
export const GOOGLE_WEB_CLIENT_ID =
  '341090907423-v5k8frredaidhknublrhfgfttq123shp.apps.googleusercontent.com';
