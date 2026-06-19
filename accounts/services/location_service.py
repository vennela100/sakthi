from django.utils import timezone
from accounts.models import LocationHistory, TrackingSession
from accounts.api.serializers import LocationHistorySerializer
import logging

logger = logging.getLogger(__name__)

class LocationService:
    @staticmethod
    def update_user_location(user, latitude, longitude, speed=None):
        """Updates user profile and logs to history."""
        user.last_latitude = latitude
        user.last_longitude = longitude
        user.last_location_time = timezone.now()
        user.save()

        # Find active session
        session = TrackingSession.objects.filter(user=user, is_active=True).first()
        sos_alert = session.sos_alert if session else None

        # Log point
        return LocationHistory.objects.create(
            user=user,
            latitude=latitude,
            longitude=longitude,
            session=session,
            sos_alert=sos_alert,
            speed=speed
        )

    @staticmethod
    def get_latest_location(user_id):
        """Fetches the latest coordinates for a specific user."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            target_user = User.objects.get(id=user_id)
            if target_user.last_latitude and target_user.last_longitude:
                return {
                    'latitude': float(target_user.last_latitude),
                    'longitude': float(target_user.last_longitude),
                    'timestamp': target_user.last_location_time
                }
            return None
        except User.DoesNotExist:
            return None

    @staticmethod
    def get_session_by_token(token):
        """Finds an active, non-expired tracking session by its UUID token."""
        now = timezone.now()
        session = TrackingSession.objects.filter(
            token=token, 
            is_active=True
        ).first()
        
        if session and session.expires_at and session.expires_at < now:
            # Auto-deactivate expired session
            session.is_active = False
            session.save()
            return None
            
        return session

    @staticmethod
    def get_latest_point_by_token(token):
        """Fetches the most recent location point for a specific tracking token."""
        session = LocationService.get_session_by_token(token)
        if not session:
            return None
            
        # Try latest point in history first, fallback to user's last known if no points yet
        point = LocationHistory.objects.filter(session=session).order_by('-timestamp').first()
        if point:
            return {
                'latitude': float(point.latitude),
                'longitude': float(point.longitude),
                'timestamp': point.timestamp,
                'speed': point.speed
            }
            
        # Fallback to current user location if session is active but no points recorded yet
        if session.user.last_latitude and session.user.last_longitude:
            return {
                'latitude': float(session.user.last_latitude),
                'longitude': float(session.user.last_longitude),
                'timestamp': session.user.last_location_time,
                'speed': 0
            }
        return None

    @staticmethod
    def get_history_by_token(token, limit=50):
        """Fetches a list of recent location points for a tracking token."""
        session = LocationService.get_session_by_token(token)
        if not session:
            return []
            
        points = LocationHistory.objects.filter(session=session).order_by('-timestamp')[:limit]
        return points

    @staticmethod
    def start_tracking_session(user, sos_alert=None):
        """Initializes a new tracking session with a 2-hour default expiration."""
        # Close any existing active sessions
        TrackingSession.objects.filter(user=user, is_active=True).update(
            is_active=False
        )

        return TrackingSession.objects.create(
            user=user, 
            sos_alert=sos_alert,
            expires_at=timezone.now() + timezone.timedelta(hours=2) # Default 2 hours
        )

    @staticmethod
    def stop_tracking_session(user):
        """Ends all active tracking sessions for a user."""
        return TrackingSession.objects.filter(user=user, is_active=True).update(
            is_active=False
        )
