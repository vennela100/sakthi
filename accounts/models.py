import uuid
from django.contrib.auth.models import AbstractUser  # type: ignore
from django.db import models  # type: ignore
from django.conf import settings  # type: ignore


class CustomUser(AbstractUser):
    """Custom user model for Shakthi Safety App."""
    phone_number = models.CharField(max_length=15, blank=True)
    is_setup_complete = models.BooleanField(default=False)
    home_address = models.CharField(max_length=255, blank=True, null=True)
    work_address = models.CharField(max_length=255, blank=True, null=True)
    profile_picture = models.ImageField(upload_to='profiles/', blank=True, null=True)
    
    # Live Location Tracking
    last_latitude = models.FloatField(null=True, blank=True)
    last_longitude = models.FloatField(null=True, blank=True)
    last_location_time = models.DateTimeField(null=True, blank=True)

    # Firebase Cloud Messaging — device push token
    fcm_token = models.CharField(max_length=512, blank=True, null=True)

    def __str__(self):
        return self.username


class SOSAlert(models.Model):
    """Stores SOS emergency alerts."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sos_alerts')
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    
    # Status tracking for Twilio
    STATUS_CHOICES = [
        ('triggered', 'Triggered'),
        ('sent', 'Sent to Contacts'),
        ('failed', 'Delivery Failed'),
        ('cancelled', 'User Cancelled'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='triggered')
    alert_sid = models.CharField(max_length=100, blank=True, null=True)
    failure_reason = models.TextField(blank=True, null=True)
    
    is_active = models.BooleanField(default=True)
    deactivated_at = models.DateTimeField(null=True, blank=True)
    message = models.TextField(blank=True)
    
    # Media Evidence
    image = models.ImageField(upload_to='sos/images/', blank=True, null=True)
    audio = models.FileField(upload_to='sos/audio/', blank=True, null=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp']),
        ]

    def __str__(self):
        return f"SOS Alert by {self.user.username} at {self.timestamp}"


class EmergencyContact(models.Model):
    """Stores emergency contacts for a user."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='shakthi_contacts')
    contact_name = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=15)
    relationship = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.contact_name} ({self.phone_number})"


class SafetyZone(models.Model):
    """Safety zones and reported areas."""
    ZONE_TYPES = [
        ('safe', 'Safe Zone'),
        ('suspicious', 'Suspicious area'),
        ('danger', 'High Risk'),
    ]
    name = models.CharField(max_length=100)
    zone_type = models.CharField(max_length=20, choices=ZONE_TYPES)
    latitude = models.FloatField()
    longitude = models.FloatField()
    radius_meters = models.PositiveIntegerField(default=100)
    description = models.TextField(blank=True)
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.get_zone_type_display()})"


class CommunityReport(models.Model):
    """Stores community safety reports from users."""
    REPORT_TYPES = [
        ('harassment', 'Harassment'),
        ('suspicious_activity', 'Suspicious Activity'),
        ('dark_area', 'Dark Area'),
    ]

    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High danger'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='community_reports')
    report_type = models.CharField(max_length=30, choices=REPORT_TYPES)
    severity = models.CharField(max_length=15, choices=SEVERITY_CHOICES, default='medium')
    location = models.CharField(max_length=255)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    description = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.get_report_type_display()} — {self.location}"


class LocationHistory(models.Model):
    """Historical location logs for continuous tracking and safety history."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='location_history')
    sos_alert = models.ForeignKey('SOSAlert', on_delete=models.SET_NULL, null=True, blank=True, related_name='location_trail')
    session = models.ForeignKey('TrackingSession', on_delete=models.SET_NULL, null=True, blank=True, related_name='points')
    latitude = models.FloatField()
    longitude = models.FloatField()
    speed = models.FloatField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['session', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.user.username} at {self.timestamp}"


class TrackingSession(models.Model):
    """Session-based tracking with a secure unique token for shareable links."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tracking_sessions')
    sos_alert = models.ForeignKey('SOSAlert', on_delete=models.SET_NULL, null=True, blank=True, related_name='tracking_sessions')
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    is_active = models.BooleanField(default=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f"Tracking for {self.user.username} ({self.started_at.strftime('%Y-%m-%d %H:%M')})"


class DangerZone(models.Model):
    """System-calculated high-risk areas."""
    name = models.CharField(max_length=100)
    latitude = models.FloatField()
    longitude = models.FloatField()
    risk_score = models.FloatField(default=0.0) # 0 to 100
    radius_meters = models.PositiveIntegerField(default=200)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"DangerZone: {self.name} (Score: {self.risk_score})"
