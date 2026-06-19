from django.urls import path  # type: ignore
from accounts import views  # type: ignore

urlpatterns = [
    path('', views.home_view, name='home'),
    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    
    # SOS APIs
    path('api/sos/activate/', views.sos_activate, name='sos_activate'),
    path('api/sos/upload-media/', views.sos_upload_media, name='sos_upload_media'),
    path('api/sos/deactivate/', views.sos_deactivate, name='sos_deactivate'),
    
    # Safe Route APIs
    path('calculate-safety/', views.calculate_safety_api, name='calculate_safety'),
    path('ai-analysis/', views.ai_analysis_api, name='ai_analysis'),
    path('save-location/', views.save_location_api, name='save_location'),
    
    path('emergency-contacts/', views.emergency_contacts_view, name='emergency_contacts'),
    path('emergency-contacts/delete/<int:contact_id>/', views.delete_emergency_contact, name='delete_emergency_contact'),
    path('community-reports/', views.community_reports_view, name='community_reports'),
    path('safe-route/', views.safe_route_view, name='safe_route'),
    path('live-track/', views.live_track_view, name='live_track'),
    path('nearby-places/', views.nearby_places_view, name='nearby_places'),
    path('accounts/profile-setup/', views.profile_setup_view, name='profile_setup'),

    # Reports API (JSON for map overlays)
    path('api/reports/', views.api_reports, name='api_reports'),
    
    # Real-time Public/Third-party tracking (Token Based)
    path('track/<uuid:token>/', views.track_user_view, name='track_user'),
    path('api/get-location/<uuid:token>/', views.get_location_api, name='get_location'),
]
