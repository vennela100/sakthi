from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from accounts.api.views import (
    SOSViewSet, LocationHistoryViewSet, EmergencyContactViewSet, 
    AnalyzeRouteAPIView, CommunityReportViewSet, DangerZoneViewSet, ProfileView,
    UpdateLocationView, GetLocationByTokenView, LocationHistoryByTokenView,
    StartTrackingSessionView, StopTrackingSessionView, TriggerSOSAPIView,
    RegisterFCMTokenView, EmailOrUsernameTokenObtainPairView, GeocodePlaceAPIView,
    AISafetyAssistantAPIView, GoogleLoginAPIView, RegisterAPIView,
    HealthCheckAPIView,
)

router = DefaultRouter()
router.register(r'sos', SOSViewSet, basename='api-sos')
router.register(r'location', LocationHistoryViewSet, basename='api-location')
router.register(r'contacts', EmergencyContactViewSet, basename='api-contacts')
router.register(r'community-reports', CommunityReportViewSet, basename='api-community-reports')
router.register(r'danger-zones', DangerZoneViewSet, basename='api-danger-zones')

urlpatterns = [
    # Keep-warm / liveness probe (no auth, no DB) — hit by the external pinger
    # and by the app on launch to pre-warm the free-tier server.
    path('health/', HealthCheckAPIView.as_view(), name='api-health'),

    # JWT Authentication
    path('register/', RegisterAPIView.as_view(), name='api-register'),
    path('token/', EmailOrUsernameTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/google/', GoogleLoginAPIView.as_view(), name='api-google-login'),
    
    # Profile API
    path('profile/', ProfileView.as_view(), name='api-profile'),
    
    # AI Safety Analysis
    path('analyze-route/', AnalyzeRouteAPIView.as_view(), name='api-analyze-route'),
    path('ai-assistant/', AISafetyAssistantAPIView.as_view(), name='api-ai-assistant'),
    path('geocode-place/', GeocodePlaceAPIView.as_view(), name='api-geocode-place'),
    path('trigger-sos/', TriggerSOSAPIView.as_view(), name='api-trigger-sos'),
    
    # Live Tracking & Session APIs
    path('update-location/', UpdateLocationView.as_view(), name='update-location'),
    path('get-location/<uuid:token>/', GetLocationByTokenView.as_view(), name='get-location-token'),
    path('location-history/<uuid:token>/', LocationHistoryByTokenView.as_view(), name='location-history-token'),
    path('tracking/start/', StartTrackingSessionView.as_view(), name='start-tracking'),
    path('tracking/stop/', StopTrackingSessionView.as_view(), name='stop-tracking'),

    # FCM Push Token Registration
    path('register-fcm-token/', RegisterFCMTokenView.as_view(), name='register-fcm-token'),
    
    # All Resource ViewSets
    path('', include(router.urls)),
]
