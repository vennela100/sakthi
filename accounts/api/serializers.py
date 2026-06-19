from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from accounts.models import SOSAlert, EmergencyContact, CommunityReport, LocationHistory, DangerZone, TrackingSession

User = get_user_model()


class EmailOrUsernameTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Allow mobile users to log in with either username or registered email."""

    def validate(self, attrs):
        login_value = attrs.get(self.username_field)

        if login_value and '@' in login_value:
            user = User.objects.filter(email__iexact=login_value).first()
            if user:
                attrs[self.username_field] = getattr(user, self.username_field)

        return super().validate(attrs)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name', 'email', 'phone_number', 
                  'is_setup_complete', 'profile_picture', 'last_latitude', 'last_longitude', 'last_location_time')
        read_only_fields = ('id', 'is_setup_complete')

class SOSAlertSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.first_name')
    
    class Meta:
        model = SOSAlert
        fields = ('id', 'user', 'user_name', 'timestamp', 'latitude', 'longitude', 
                  'status', 'alert_sid', 'failure_reason', 'is_active', 'message', 'image', 'audio')
        read_only_fields = ('id', 'timestamp', 'status', 'alert_sid', 'failure_reason', 'is_active')

class EmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyContact
        fields = ('id', 'user', 'contact_name', 'phone_number', 'relationship', 'created_at')
        read_only_fields = ('id', 'user', 'created_at')

class CommunityReportSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.username')
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)

    class Meta:
        model = CommunityReport
        fields = ('id', 'user', 'user_name', 'report_type', 'report_type_display', 
                  'severity', 'severity_display', 'location', 'latitude', 'longitude', 
                  'description', 'timestamp')
        read_only_fields = ('id', 'user', 'timestamp')

class LocationHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = LocationHistory
        fields = ('id', 'user', 'sos_alert', 'session', 'latitude', 'longitude', 'speed', 'timestamp')
        read_only_fields = ('id', 'user', 'timestamp')

class TrackingSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrackingSession
        fields = ('id', 'user', 'sos_alert', 'token', 'is_active', 'started_at', 'ended_at', 'expires_at')
        read_only_fields = ('id', 'user', 'token', 'started_at')

class DangerZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = DangerZone
        fields = ('id', 'name', 'latitude', 'longitude', 'risk_score', 'radius_meters', 'last_updated')
        read_only_fields = ('id', 'last_updated')

class LocationUpdateSerializer(serializers.Serializer):
    """Specifically for validating incoming location POST data."""
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    speed = serializers.FloatField(required=False, allow_null=True)

class TriggerSOSRequestSerializer(serializers.Serializer):
    """Payload for triggering an SOS with optional media evidence."""
    latitude = serializers.FloatField(min_value=-90, max_value=90, required=False, allow_null=True)
    longitude = serializers.FloatField(min_value=-180, max_value=180, required=False, allow_null=True)
    image = serializers.ImageField(required=False, allow_null=True)
    image_base64 = serializers.CharField(required=False, allow_blank=True, write_only=True)
    image_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    audio = serializers.FileField(required=False, allow_null=True)
    send_twilio_sms = serializers.BooleanField(required=False, default=True)

class LiveTrackingPointSerializer(serializers.Serializer):
    """Simplified, read-only serializer for public tracking views."""
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    timestamp = serializers.DateTimeField()
    speed = serializers.FloatField()

class AnalyzeRouteSerializer(serializers.Serializer):
    """Input payload for AI-driven route safety prediction."""
    start_lat = serializers.FloatField(min_value=-90, max_value=90)
    start_lng = serializers.FloatField(min_value=-180, max_value=180)
    end_lat = serializers.FloatField(min_value=-90, max_value=90)
    end_lng = serializers.FloatField(min_value=-180, max_value=180)
    time = serializers.CharField(required=False, default='now', help_text="day or night")


class AISafetyAssistantSerializer(serializers.Serializer):
    """Question payload for the AI safety assistant."""
    message = serializers.CharField(max_length=1200)
    latitude = serializers.FloatField(min_value=-90, max_value=90, required=False, allow_null=True)
    longitude = serializers.FloatField(min_value=-180, max_value=180, required=False, allow_null=True)


class RegisterFCMTokenSerializer(serializers.Serializer):
    """Payload for registering a Firebase Cloud Messaging device token."""
    fcm_token = serializers.CharField(
        max_length=512,
        help_text="FCM registration token from the React Native app.",
    )


class RegisterSerializer(serializers.Serializer):
    """New-account payload for the mobile sign-up flow."""
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(min_length=6, write_only=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=15, required=False, allow_blank=True)

    def validate_username(self, value):
        from django.contrib.auth import get_user_model
        value = value.strip()
        if get_user_model().objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('That username is already taken.')
        return value

    def validate_email(self, value):
        if not value:
            return value
        from django.contrib.auth import get_user_model
        if get_user_model().objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with that email already exists.')
        return value
