import base64
import binascii
import json
import logging
import math
from datetime import timedelta
from django.utils import timezone
from django.core.cache import cache
from django.shortcuts import get_object_or_404
import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.files.base import ContentFile
from rest_framework import viewsets, permissions, status, views, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import Throttled
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import AllowAny
from django.contrib.auth import get_user_model
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from accounts.models import SOSAlert, EmergencyContact, CommunityReport, LocationHistory, DangerZone, TrackingSession
from accounts.api.serializers import (
    SOSAlertSerializer, EmergencyContactSerializer, CommunityReportSerializer, 
    LocationHistorySerializer, DangerZoneSerializer, UserSerializer, TrackingSessionSerializer,
    AnalyzeRouteSerializer, EmailOrUsernameTokenObtainPairSerializer, LocationUpdateSerializer, LiveTrackingPointSerializer,
    TriggerSOSRequestSerializer, RegisterFCMTokenSerializer, AISafetyAssistantSerializer,
    RegisterSerializer
)
from accounts.services.sos_service import SOSService
from accounts.services.location_service import LocationService
from accounts.services.ai_service import AIService

logger = logging.getLogger(__name__)


class HealthCheckAPIView(views.APIView):
    """Lightweight, public, DB-free liveness probe.

    Used by an external keep-warm pinger (and the app on launch) to wake the
    free-tier server before a user signs in, so they never hit a 30-60s cold
    start. Deliberately touches no database or external service so it stays
    fast and can't fail while the rest of the stack is still booting.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({'status': 'ok'}, status=status.HTTP_200_OK)


class EmailOrUsernameTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailOrUsernameTokenObtainPairSerializer


class RegisterAPIView(views.APIView):
    """
    POST /api/v1/register/

    Creates a new account and returns a JWT pair so the mobile app logs the
    user straight in after sign-up (same token shape as /token/).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        User = get_user_model()
        user = User.objects.create_user(
            username=data['username'],
            email=data.get('email', '') or '',
            password=data['password'],
            first_name=data.get('first_name', '') or '',
        )
        phone = data.get('phone_number')
        if phone:
            user.phone_number = phone
            user.save(update_fields=['phone_number'])

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'username': user.username,
            },
            status=status.HTTP_201_CREATED,
        )


class GoogleLoginAPIView(views.APIView):
    """
    Native Google Sign-In for the mobile app.

    The app sends the Google `id_token` obtained from the Google Sign-In SDK.
    We verify it against Google, then find-or-create the matching user and
    return the same SimpleJWT access/refresh pair the username/password flow
    returns, so the rest of the app is unchanged.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        token = request.data.get('id_token') or request.data.get('idToken')
        if not token:
            return Response({'detail': 'Missing id_token.'}, status=status.HTTP_400_BAD_REQUEST)

        allowed_audiences = getattr(settings, 'GOOGLE_OAUTH_CLIENT_IDS', [])

        try:
            # audience=None: verify signature/expiry/issuer, then check aud ourselves
            # so we can accept the web client id used by the mobile SDK.
            idinfo = google_id_token.verify_oauth2_token(token, google_requests.Request())
        except ValueError:
            return Response({'detail': 'Invalid Google token.'}, status=status.HTTP_401_UNAUTHORIZED)

        if idinfo.get('iss') not in ('accounts.google.com', 'https://accounts.google.com'):
            return Response({'detail': 'Wrong token issuer.'}, status=status.HTTP_401_UNAUTHORIZED)

        if allowed_audiences and idinfo.get('aud') not in allowed_audiences:
            return Response({'detail': 'Token audience not allowed.'}, status=status.HTTP_401_UNAUTHORIZED)

        email = (idinfo.get('email') or '').strip().lower()
        if not email or not idinfo.get('email_verified', False):
            return Response({'detail': 'Google account email unavailable or unverified.'},
                            status=status.HTTP_401_UNAUTHORIZED)

        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            base_username = email.split('@')[0]
            username = base_username
            suffix = 1
            while User.objects.filter(username=username).exists():
                suffix += 1
                username = f'{base_username}{suffix}'
            user = User.objects.create(
                username=username,
                email=email,
                first_name=idinfo.get('given_name', ''),
                last_name=idinfo.get('family_name', ''),
            )
            user.set_unusable_password()
            user.save()

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'username': user.username,
            'email': user.email,
        }, status=status.HTTP_200_OK)


class SOSViewSet(viewsets.ModelViewSet):
    """
    API for SOS alerts with Twilio integration and real-time status tracking.
    """
    serializer_class = SOSAlertSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)

    def get_queryset(self):
        return SOSAlert.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        latitude = serializer.validated_data.get('latitude')
        longitude = serializer.validated_data.get('longitude')
        image = serializer.validated_data.get('image')
        audio = serializer.validated_data.get('audio')
        
        # Use service to trigger SOS (returns sos object and token)
        sos, token = SOSService.trigger_sos(
            self.request.user, 
            latitude, 
            longitude, 
            image=image, 
            audio=audio,
            send_twilio_sms=serializer.validated_data.get('send_twilio_sms', True)
        )
        
        serializer.instance = sos

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Manually mark user as safe."""
        SOSService.deactivate_sos(request.user)
        LocationService.stop_tracking_session(request.user)
        return Response({'status': 'SOS deactivated successfully.'})

    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Fetch latest alert for the user."""
        sos = self.get_queryset().first()
        if not sos:
            return Response({'detail': 'No alerts found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(sos)
        return Response(serializer.data)

    @action(detail=True, methods=['delete'], url_path='evidence')
    def delete_evidence(self, request, pk=None):
        """Delete saved media evidence while keeping the SOS alert record."""
        sos = self.get_object()
        deleted = False

        for field_name in ('image', 'audio'):
            media_file = getattr(sos, field_name)
            if media_file:
                # .delete() routes to the storage backend — for Cloudinary this
                # calls its destroy() API, freeing the space. Surface a failure
                # instead of silently leaving the file orphaned in storage.
                try:
                    media_file.delete(save=False)
                except Exception as e:
                    logger.warning('Failed to delete %s for SOS %s: %s', field_name, sos.pk, e)
                    return Response(
                        {'detail': f'Could not remove {field_name} from storage: {e}'},
                        status=status.HTTP_502_BAD_GATEWAY,
                    )
                setattr(sos, field_name, None)
                deleted = True

        if deleted:
            sos.save(update_fields=['image', 'audio'])

        return Response({'status': 'Evidence deleted successfully.', 'deleted': deleted})


class TriggerSOSAPIView(views.APIView):
    """
    Consolidated API to trigger SOS + upload media + start tracking in one call.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)

    @staticmethod
    def _image_from_base64(image_base64, image_name):
        if not image_base64:
            return None

        payload = image_base64.split(',', 1)[1] if ',' in image_base64 else image_base64
        try:
            decoded = base64.b64decode(payload, validate=True)
        except (binascii.Error, ValueError):
            return None

        safe_name = image_name or 'sos_evidence.jpg'
        if not safe_name.lower().endswith(('.jpg', '.jpeg', '.png')):
            safe_name = f'{safe_name}.jpg'
        return ContentFile(decoded, name=safe_name)

    def post(self, request):
        serializer = TriggerSOSRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        image = data.get('image') or self._image_from_base64(
            data.get('image_base64'),
            data.get('image_name'),
        )
        
        # Trigger SOS flow
        sos, token = SOSService.trigger_sos(
            request.user, 
            data.get('latitude'), 
            data.get('longitude'),
            image=image,
            audio=data.get('audio'),
            send_twilio_sms=data.get('send_twilio_sms', True)
        )
        
        # Dynamic base URL for the tracking link
        base_url = getattr(settings, 'SITE_URL', request.build_absolute_uri('/')[:-1]).rstrip('/')
        tracking_url = f"{base_url}/track/{token}/"
        evidence_url = f"{base_url}{sos.image.url}" if sos.image else None

        # Evidence may have failed to save (e.g. storage full) without failing the
        # SOS itself; the app uses this to warn the user.
        evidence_status = getattr(sos, 'evidence_status', 'ok')

        return Response({
            'status': 'SOS triggered successfully',
            'sos_id': sos.id,
            'token': str(token),
            'tracking_url': tracking_url,
            'evidence_url': evidence_url,
            'evidence_status': evidence_status,
            'storage_full': evidence_status == 'storage_full',
        })


class LocationHistoryViewSet(viewsets.ModelViewSet):
    """
    API for user location tracking.
    """
    serializer_class = LocationHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return LocationHistory.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Update user's current location on their profile as well
        user = self.request.user
        latitude = serializer.validated_data.get('latitude')
        longitude = serializer.validated_data.get('longitude')
        
        user.last_latitude = latitude
        user.last_longitude = longitude
        user.last_location_time = timezone.now()
        user.save()
        
        serializer.save(user=user)


class EmergencyContactViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for managing emergency contacts.
    """
    serializer_class = EmergencyContactSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return EmergencyContact.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CommunityReportViewSet(viewsets.ModelViewSet):
    """
    Mobile API for the same community safety reports used by the web app.
    """
    serializer_class = CommunityReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CommunityReport.objects.all().order_by('-timestamp')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AnalyzeRouteAPIView(views.APIView):
    """
    Endpoint for Google Gemini AI safety analysis of a specific route.
    """
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _decode_polyline(polyline):
        index = 0
        lat = 0
        lng = 0
        points = []

        while index < len(polyline):
            shift = 0
            result = 0
            while True:
                byte = ord(polyline[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            lat += ~(result >> 1) if result & 1 else result >> 1

            shift = 0
            result = 0
            while True:
                byte = ord(polyline[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            lng += ~(result >> 1) if result & 1 else result >> 1

            points.append({'latitude': lat / 1e5, 'longitude': lng / 1e5})

        return points

    @staticmethod
    def _haversine_meters(lat1, lng1, lat2, lng2):
        radius = 6371000
        phi1 = math.radians(float(lat1))
        phi2 = math.radians(float(lat2))
        d_phi = math.radians(float(lat2) - float(lat1))
        d_lambda = math.radians(float(lng2) - float(lng1))
        a = (
            math.sin(d_phi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
        )
        return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    @classmethod
    def _distance_to_route_meters(cls, report_lat, report_lng, route_points):
        if not route_points:
            return None

        return min(
            cls._haversine_meters(report_lat, report_lng, point['latitude'], point['longitude'])
            for point in route_points
        )

    @classmethod
    def _community_report_risk(cls, route_points):
        if not route_points:
            return {
                'score': 0,
                'reports': [],
                'summary': 'No route points available for community report analysis.',
            }

        latitudes = [point['latitude'] for point in route_points]
        longitudes = [point['longitude'] for point in route_points]
        margin = 0.03
        since = timezone.now() - timedelta(days=180)
        reports = CommunityReport.objects.filter(
            latitude__isnull=False,
            longitude__isnull=False,
            timestamp__gte=since,
            latitude__gte=min(latitudes) - margin,
            latitude__lte=max(latitudes) + margin,
            longitude__gte=min(longitudes) - margin,
            longitude__lte=max(longitudes) + margin,
        ).order_by('-timestamp')[:250]

        severity_weight = {'low': 10, 'medium': 22, 'high': 38}
        type_weight = {'dark_area': 6, 'suspicious_activity': 9, 'harassment': 13}
        nearby = []
        score_total = 0

        for report in reports:
            distance = cls._distance_to_route_meters(report.latitude, report.longitude, route_points)
            if distance is None or distance > 1000:
                continue

            if distance <= 150:
                distance_factor = 1.0
            elif distance <= 400:
                distance_factor = 0.72
            elif distance <= 700:
                distance_factor = 0.42
            else:
                distance_factor = 0.2

            age_days = max((timezone.now() - report.timestamp).days, 0)
            if age_days <= 7:
                recency_factor = 1.2
            elif age_days <= 30:
                recency_factor = 1.0
            elif age_days <= 90:
                recency_factor = 0.75
            else:
                recency_factor = 0.45

            report_score = (
                severity_weight.get(report.severity, 18)
                + type_weight.get(report.report_type, 5)
            ) * distance_factor * recency_factor
            score_total += report_score
            nearby.append({
                'id': report.id,
                'type': report.get_report_type_display(),
                'severity': report.get_severity_display(),
                'location': report.location,
                'latitude': report.latitude,
                'longitude': report.longitude,
                'distance_meters': round(distance),
                'age_days': age_days,
            })

        score = min(100, round(score_total))
        summary = (
            f'{len(nearby)} community report(s) found near this route.'
            if nearby
            else 'No recent community reports found near this route.'
        )
        return {'score': score, 'reports': nearby[:8], 'summary': summary}

    @classmethod
    def _danger_zone_risk(cls, route_points):
        if not route_points:
            return {
                'score': 0,
                'zones': [],
                'summary': 'No route points available for danger zone analysis.',
            }

        latitudes = [point['latitude'] for point in route_points]
        longitudes = [point['longitude'] for point in route_points]
        margin = 0.04
        zones = DangerZone.objects.filter(
            latitude__gte=min(latitudes) - margin,
            latitude__lte=max(latitudes) + margin,
            longitude__gte=min(longitudes) - margin,
            longitude__lte=max(longitudes) + margin,
        ).order_by('-risk_score')[:100]

        matched = []
        score = 0
        for zone in zones:
            distance = cls._distance_to_route_meters(zone.latitude, zone.longitude, route_points)
            if distance is None:
                continue

            alert_radius = max(zone.radius_meters, 200)
            if distance > alert_radius:
                continue

            distance_factor = 1.0 if distance <= zone.radius_meters else 0.75
            zone_score = min(100, round(float(zone.risk_score) * distance_factor))
            score = max(score, zone_score)
            matched.append({
                'id': zone.id,
                'name': zone.name,
                'latitude': zone.latitude,
                'longitude': zone.longitude,
                'risk_score': round(float(zone.risk_score)),
                'radius_meters': zone.radius_meters,
                'distance_meters': round(distance),
            })

        summary = (
            f'{len(matched)} calculated danger zone(s) intersect this route.'
            if matched
            else 'No calculated danger zones intersect this route.'
        )
        return {'score': score, 'zones': matched[:8], 'summary': summary}

    @staticmethod
    def _safety_level(score):
        if score >= 70:
            return 'Red Zone'
        if score >= 40:
            return 'Yellow Zone'
        return 'Safe Zone'

    @staticmethod
    def _offset_point(lat, lng, meters_north, meters_east):
        lat = float(lat)
        lng = float(lng)
        new_lat = lat + (meters_north / 111320)
        lng_scale = max(math.cos(math.radians(lat)), 0.2)
        new_lng = lng + (meters_east / (111320 * lng_scale))
        return {'latitude': new_lat, 'longitude': new_lng}

    @classmethod
    def _build_synthetic_route(cls, start_lat, start_lng, end_lat, end_lng, label, offset_meters):
        start = {'latitude': float(start_lat), 'longitude': float(start_lng)}
        end = {'latitude': float(end_lat), 'longitude': float(end_lng)}
        mid_lat = (start['latitude'] + end['latitude']) / 2
        mid_lng = (start['longitude'] + end['longitude']) / 2

        d_lat = end['latitude'] - start['latitude']
        d_lng = end['longitude'] - start['longitude']
        distance = math.sqrt((d_lat ** 2) + (d_lng ** 2)) or 1
        # Perpendicular direction around the direct path.
        north = (-d_lng / distance) * offset_meters
        east = (d_lat / distance) * offset_meters
        waypoint = cls._offset_point(mid_lat, mid_lng, north, east)

        return {
            'id': f'synthetic-{label.lower().replace(" ", "-")}',
            'points': [start, waypoint, end],
            'source': 'generated',
            'summary': label,
            'distance': 'Estimated',
            'duration': 'Estimated',
        }

    @classmethod
    def _ensure_route_candidates(cls, routes, start_lat, start_lng, end_lat, end_lng):
        candidates = list(routes)
        if len(candidates) >= 3:
            return candidates

        existing_ids = {route.get('id') for route in candidates}
        generated = [
            cls._build_synthetic_route(start_lat, start_lng, end_lat, end_lng, 'North-side alternate', 450),
            cls._build_synthetic_route(start_lat, start_lng, end_lat, end_lng, 'South-side alternate', -450),
            cls._build_synthetic_route(start_lat, start_lng, end_lat, end_lng, 'Wide alternate', 900),
        ]
        for route in generated:
            if route['id'] not in existing_ids:
                candidates.append(route)
            if len(candidates) >= 3:
                break
        return candidates

    @classmethod
    def _route_warnings(cls, community, danger_zones, route_score):
        warnings = []
        red_reports = [
            report for report in community.get('reports', [])
            if str(report.get('severity', '')).lower().startswith('high') or report.get('distance_meters', 9999) <= 150
        ]
        red_zones = [
            zone for zone in danger_zones.get('zones', [])
            if zone.get('risk_score', 0) >= 70 or zone.get('distance_meters', 9999) <= zone.get('radius_meters', 0)
        ]

        if route_score >= 70:
            warnings.append('You are entering a Red Zone. Prefer another route or use live tracking.')
        for zone in red_zones[:3]:
            warnings.append(
                f"You are entering Red Zone near {zone['name']} ({zone['distance_meters']}m from route)."
            )
        for report in red_reports[:3]:
            warnings.append(
                f"High-risk community report near {report['location']} ({report['distance_meters']}m from route)."
            )

        return warnings

    @classmethod
    def _get_route_options(cls, start_lat, start_lng, end_lat, end_lng):
        api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
        fallback = [
            {'latitude': float(start_lat), 'longitude': float(start_lng)},
            {'latitude': float(end_lat), 'longitude': float(end_lng)},
        ]
        if not api_key:
            return [{
                'id': 'fallback-1',
                'points': fallback,
                'source': 'fallback',
                'summary': 'Direct fallback route',
            }]

        query = urlencode({
            'origin': f'{start_lat},{start_lng}',
            'destination': f'{end_lat},{end_lng}',
            'mode': 'walking',
            'alternatives': 'true',
            'key': api_key,
        })
        url = f'https://maps.googleapis.com/maps/api/directions/json?{query}'
        try:
            with urlopen(url, timeout=8) as response:
                payload = json.loads(response.read().decode('utf-8'))
        except Exception:
            return [{
                'id': 'fallback-1',
                'points': fallback,
                'source': 'fallback',
                'summary': 'Direct fallback route',
            }]

        if payload.get('status') != 'OK' or not payload.get('routes'):
            return [{
                'id': 'fallback-1',
                'points': fallback,
                'source': 'fallback',
                'summary': 'Direct fallback route',
            }]

        options = []
        for index, route in enumerate(payload['routes'][:4], start=1):
            overview = route.get('overview_polyline', {}).get('points')
            points = cls._decode_polyline(overview) if overview else fallback
            leg = (route.get('legs') or [{}])[0]
            options.append({
                'id': f'route-{index}',
                'points': points or fallback,
                'source': 'google',
                'summary': route.get('summary') or f'Route {index}',
                'distance': (leg.get('distance') or {}).get('text'),
                'duration': (leg.get('duration') or {}).get('text'),
            })

        return options or [{
            'id': 'fallback-1',
            'points': fallback,
            'source': 'fallback',
            'summary': 'Direct fallback route',
        }]

    def post(self, request):
        serializer = AnalyzeRouteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        
        # Call AI Service
        analysis = AIService.analyze_route_safety(
            start_lat=data['start_lat'],
            start_lng=data['start_lng'],
            end_lat=data['end_lat'],
            end_lng=data['end_lng'],
            time_of_day=data.get('time', 'now')
        )
        route_options = self._get_route_options(
            data['start_lat'],
            data['start_lng'],
            data['end_lat'],
            data['end_lng'],
        )
        route_options = self._ensure_route_candidates(
            route_options,
            data['start_lat'],
            data['start_lng'],
            data['end_lat'],
            data['end_lng'],
        )
        # When the AI is unavailable (rate-limited / key missing), its risk_score
        # is a flat 50 placeholder that would floor every route and paint
        # everything one colour. Instead we score from real local data: a small
        # ambient baseline (a bit higher at night) plus the actual community
        # reports + danger zones near the route ADDED on top — so a route past a
        # reported spot reads riskier than an unknown one, and different places
        # genuinely differ. When the AI IS available we keep the blended max().
        fallback_active = bool(analysis.get('is_fallback'))
        if fallback_active:
            import datetime
            hour = datetime.datetime.now().hour
            ambient_baseline = 25 if (hour >= 20 or hour < 5) else 8
            original_score = 0
        else:
            ambient_baseline = 0
            original_score = int(analysis.get('risk_score') or 0)

        scored_options = []
        for index, route in enumerate(route_options, start=1):
            community = self._community_report_risk(route.get('points', []))
            danger_zones = self._danger_zone_risk(route.get('points', []))
            community_score = int(community['score'])
            danger_zone_score = int(danger_zones['score'])
            route_score = max(community_score, danger_zone_score)
            if fallback_active:
                final_score = min(100, ambient_baseline + route_score)
            else:
                final_score = max(original_score, route_score)
            warnings = self._route_warnings(community, danger_zones, final_score)

            scored_options.append({
                **route,
                'rank': index,
                'risk_score': final_score,
                'route_specific_risk_score': route_score,
                'community_report_score': community_score,
                'danger_zone_score': danger_zone_score,
                'safety_level': self._safety_level(final_score),
                'community_reports_near_route': community['reports'],
                'danger_zones_near_route': danger_zones['zones'],
                'community_report_summary': community['summary'],
                'danger_zone_summary': danger_zones['summary'],
                'warnings': warnings,
            })

        safest = min(
            scored_options,
            key=lambda option: (option['route_specific_risk_score'], option['risk_score'], option.get('rank', 999)),
        )
        safest['is_recommended'] = True
        for option in scored_options:
            option['recommendation_label'] = 'Safest route' if option['id'] == safest['id'] else 'Alternative route'

        final_score = safest['risk_score']

        analysis['risk_score'] = final_score
        analysis['community_report_score'] = safest['community_report_score']
        analysis['danger_zone_score'] = safest['danger_zone_score']
        analysis['community_reports_near_route'] = safest['community_reports_near_route']
        analysis['danger_zones_near_route'] = safest['danger_zones_near_route']
        analysis['community_report_summary'] = safest['community_report_summary']
        analysis['danger_zone_summary'] = safest['danger_zone_summary']
        analysis['route'] = safest
        analysis['route_options'] = scored_options
        analysis['route_warnings'] = safest['warnings']
        analysis['start'] = {'latitude': data['start_lat'], 'longitude': data['start_lng']}
        analysis['destination'] = {'latitude': data['end_lat'], 'longitude': data['end_lng']}

        analysis['safety_level'] = self._safety_level(final_score)

        community_note = (
            f" Safest route selected from {len(scored_options)} option(s). "
            f"Community report analysis: {safest['community_report_summary']} "
            f"Community score is {safest['community_report_score']}/100. "
            f"Danger zone analysis: {safest['danger_zone_summary']} "
            f"Danger zone score is {safest['danger_zone_score']}/100."
        )
        analysis['explanation'] = f"{analysis.get('explanation', '').strip()}{community_note}".strip()
        if safest['warnings']:
            suggestions = analysis.get('suggestions') or []
            suggestions.insert(0, safest['warnings'][0])
            analysis['suggestions'] = suggestions
        elif safest['community_reports_near_route'] or safest['danger_zones_near_route']:
            suggestions = analysis.get('suggestions') or []
            suggestions.insert(0, 'Avoid reported spots near the route and prefer a busier alternate road if available.')
            analysis['suggestions'] = suggestions
        
        return Response(analysis)


class GeocodePlaceAPIView(views.APIView):
    """
    Resolve a destination place name to coordinates for the mobile safe-route flow.
    """
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _destination_queries(place):
        normalized = ' '.join(place.replace(',', ' ').split())
        lower = normalized.lower()
        variants = [normalized]

        replacements = {
            'ananthapur': 'anantapur',
            'ananthapuramu': 'anantapur',
            'hindupur': 'hindupuram',
        }
        fixed = lower
        for old, new in replacements.items():
            fixed = fixed.replace(old, new)

        if fixed != lower:
            variants.append(fixed)

        if 'sk university' in lower or 's k university' in lower:
            variants.extend([
                'Sri Krishnadevaraya University Anantapur Andhra Pradesh India',
                'S K University Anantapur Andhra Pradesh India',
                'Sri Krishnadevaraya University Anantapuramu India',
            ])

        if ('rtc' in lower or 'bus stand' in lower or 'bus station' in lower) and (
            'anantapur' in fixed or 'ananthapur' in lower or 'anantapuramu' in lower
        ):
            variants.extend([
                'APSRTC Bus Station Anantapur Andhra Pradesh India',
                'RTC Bus Stand Anantapur Andhra Pradesh India',
                'Anantapur Bus Station Andhra Pradesh India',
                'Anantapur Central Bus Station Andhra Pradesh India',
                'Anantapuramu APSRTC Bus Station Andhra Pradesh India',
                'RTC Bus Stand Anantapuramu Andhra Pradesh India',
            ])

        if ('railway' in lower or 'train station' in lower) and (
            'anantapur' in fixed or 'ananthapur' in lower or 'anantapuramu' in lower
        ):
            variants.extend([
                'Anantapur Railway Station Andhra Pradesh India',
                'Anantapuramu Railway Station Andhra Pradesh India',
            ])

        if 'mits' in lower and ('madanapalli' in lower or 'madanapalle' in lower or 'madanapalli' in fixed or 'madanapalle' in fixed):
            variants.extend([
                'Madanapalle Institute of Technology and Science Angallu Andhra Pradesh India',
                'Madanapalle Institute of Technology & Science Angallu Madanapalle Andhra Pradesh India',
                'MITS Deemed to be University Angallu Madanapalle Andhra Pradesh India',
                'MITS Madanapalle Angallu Andhra Pradesh India',
                'MITS College Angallu Madanapalle Andhra Pradesh India',
                'Madanapalle Institute of Technology and Science Kadiri Road Angallu',
            ])

        if 'madanapalli' in lower:
            variants.append(normalized.lower().replace('madanapalli', 'madanapalle'))
        if 'madanapalle' in lower:
            variants.append(normalized.lower().replace('madanapalle', 'madanapalli'))

        expanded = []
        for item in variants:
            expanded.append(item)
            if 'india' not in item.lower():
                expanded.append(f'{item} India')
            if 'anantapur' in item.lower() and 'andhra' not in item.lower():
                expanded.append(f'{item} Andhra Pradesh India')

        seen = set()
        unique = []
        for item in expanded:
            key = item.lower()
            if key not in seen:
                seen.add(key)
                unique.append(item)
        return unique[:10]

    @staticmethod
    def _google_geocode(place, api_key):
        query = urlencode({'address': place, 'key': api_key, 'region': 'in'})
        url = f'https://maps.googleapis.com/maps/api/geocode/json?{query}'
        with urlopen(url, timeout=8) as response:
            payload = json.loads(response.read().decode('utf-8'))
        if payload.get('status') != 'OK' or not payload.get('results'):
            return None, payload.get('error_message') or payload.get('status')

        result = payload['results'][0]
        location = result['geometry']['location']
        return {
            'latitude': location['lat'],
            'longitude': location['lng'],
            'label': result.get('formatted_address', place),
            'source': 'google',
        }, None

    @staticmethod
    def _osm_geocode(place, country_limited=True):
        query = urlencode({
            'q': place,
            'format': 'json',
            'limit': 1,
            'addressdetails': 1,
        })
        if country_limited:
            query = urlencode({
                'q': place,
                'format': 'json',
                'limit': 1,
                'countrycodes': 'in',
                'addressdetails': 1,
            })
        request = Request(
            f'https://nominatim.openstreetmap.org/search?{query}',
            headers={'User-Agent': 'SakthiSafetyMobile/1.0 (local development)'},
        )
        with urlopen(request, timeout=8) as response:
            fallback = json.loads(response.read().decode('utf-8'))
        if not fallback:
            return None

        result = fallback[0]
        return {
            'latitude': float(result['lat']),
            'longitude': float(result['lon']),
            'label': result.get('display_name', place),
            'source': 'openstreetmap',
        }

    def get(self, request):
        place = (request.query_params.get('q') or '').strip()
        if not place:
            return Response({'detail': 'Destination place is required.'}, status=status.HTTP_400_BAD_REQUEST)

        errors = []
        api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
        for query in self._destination_queries(place):
            if api_key:
                try:
                    result, error = self._google_geocode(query, api_key)
                    if result:
                        return Response(result)
                    errors.append(f'Google "{query}": {error}')
                except Exception as exc:
                    errors.append(f'Google "{query}": {exc}')

            try:
                result = self._osm_geocode(query)
                if result:
                    return Response(result)
            except Exception as exc:
                errors.append(f'OSM "{query}": {exc}')

            try:
                result = self._osm_geocode(query, country_limited=False)
                if result:
                    return Response(result)
            except Exception as exc:
                errors.append(f'OSM wide "{query}": {exc}')

        return Response(
            {
                'detail': 'Destination place not found. Try adding city, district, and state.',
                'attempted_queries': self._destination_queries(place),
                'errors': errors[-3:],
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class AISafetyAssistantAPIView(views.APIView):
    """
    AI assistant endpoint for short contextual safety guidance.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = AISafetyAssistantSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        result = AIService.safety_assistant(
            request.user,
            data['message'],
            latitude=data.get('latitude'),
            longitude=data.get('longitude'),
        )
        return Response(result)


class DangerZoneViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API for fetching calculated danger zones.
    """
    queryset = DangerZone.objects.all()
    serializer_class = DangerZoneSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'])
    def calculate(self, request):
        """
        Logic to calculate danger areas based on report density.
        For production, this would be a background task.
        """
        # Simple density-based logic: Locations with >3 reports are danger zones
        reports = CommunityReport.objects.values('location', 'latitude', 'longitude').distinct()
        
        created_count = 0
        for report in reports:
            count = CommunityReport.objects.filter(location=report['location']).count()
            if count >= 3:
                DangerZone.objects.update_or_create(
                    name=report['location'],
                    defaults={
                        'latitude': report['latitude'],
                        'longitude': report['longitude'],
                        'risk_score': min(100, count * 15)
                    }
                )
                created_count += 1
                
        return Response({'status': 'Calculated', 'new_zones': created_count})


class ProfileView(views.APIView):
    """
    Current user profile information.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class UpdateLocationView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        
        # 1. Basic Rate Limiting: 5-second interval
        cache_key = f"loc_limit_{user.id}"
        if cache.get(cache_key):
            raise Throttled(detail="Please wait 5 seconds between location updates.")
        cache.set(cache_key, True, 5)

        # 2. Validation using Serializer (Coordinates -90/90, -180/180)
        serializer = LocationUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        
        # 3. Save via Service
        point = LocationService.update_user_location(
            user, 
            data['latitude'], 
            data['longitude'], 
            speed=data.get('speed')
        )

        return Response({
            'status': 'Location updated',
            'timestamp': point.timestamp,
            'point_id': point.id
        })


class GetLocationByTokenView(views.APIView):
    """
    Public-facing (token protected) API to get the latest location for a tracking session.
    No login required if token is valid and active.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        latest = LocationService.get_latest_point_by_token(token)
        if not latest:
            return Response({
                'error': 'Tracking session inactive or expired.'
            }, status=status.HTTP_403_FORBIDDEN)
            
        serializer = LiveTrackingPointSerializer(latest)
        return Response(serializer.data)


class LocationHistoryByTokenView(views.APIView):
    """
    Public-facing API for full route history of a tracking session.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        points = LocationService.get_history_by_token(token)
        if not points and not LocationService.get_session_by_token(token):
             return Response({
                'error': 'Tracking session inactive or expired.'
            }, status=status.HTTP_403_FORBIDDEN)
            
        serializer = LocationHistorySerializer(points, many=True)
        return Response(serializer.data)


class StartTrackingSessionView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        sos_alert_id = request.data.get('sos_alert_id')
        sos_alert = None
        if sos_alert_id:
            sos_alert = get_object_or_404(SOSAlert, id=sos_alert_id, user=request.user)

        session = LocationService.start_tracking_session(request.user, sos_alert=sos_alert)
        return Response({
            'status': 'Tracking session started',
            'session_id': session.id
        })


class StopTrackingSessionView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        LocationService.stop_tracking_session(request.user)
        return Response({'status': 'Tracking session stopped'})


class RegisterFCMTokenView(views.APIView):
    """
    Stores the Firebase Cloud Messaging device token for the authenticated user.
    Called by the React Native app after login to enable push notifications.

    POST /api/v1/register-fcm-token/
    Body: { "fcm_token": "<device-token>" }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = RegisterFCMTokenSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        token = serializer.validated_data['fcm_token']
        request.user.fcm_token = token
        request.user.save(update_fields=['fcm_token'])

        return Response({'status': 'FCM token registered successfully.'})
