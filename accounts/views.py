import json
from django.shortcuts import render, redirect, get_object_or_404  # type: ignore
from django.contrib.auth import login, logout  # type: ignore
from django.contrib.auth.decorators import login_required  # type: ignore
from django.contrib import messages  # type: ignore
from django.http import JsonResponse  # type: ignore
from django.views.decorators.http import require_POST  # type: ignore
from django.utils import timezone  # type: ignore
from accounts.forms import RegisterForm, LoginForm, EmergencyContactForm, CommunityReportForm, ProfileDetailsForm, EmergencyContactSetupForm  # type: ignore
from accounts.models import SOSAlert, EmergencyContact, CommunityReport, SafetyZone, LocationHistory, TrackingSession
from accounts.services.sos_service import SOSService
from accounts.services.location_service import LocationService
from accounts.services.ai_service import AIService
from accounts.services.safety_service import SafetyService
from django.conf import settings
import logging

import urllib.request
import urllib.parse

logger = logging.getLogger(__name__)




def register_view(request):
    """Handle user registration."""
    if request.user.is_authenticated:
        return redirect('home')

    if request.method == 'POST':
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user, backend='django.contrib.auth.backends.ModelBackend')
            messages.success(request, f'Welcome, {user.first_name}! Let\'s set up your safety profile.')
            return redirect('profile_setup')
        else:
            messages.error(request, 'Please correct the errors below.')
    else:
        form = RegisterForm()

    return render(request, 'accounts/register.html', {'form': form})


def login_view(request):
    """Handle user login."""
    if request.user.is_authenticated:
        return redirect('home')

    if request.method == 'POST':
        form = LoginForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            messages.success(request, f'Welcome back, {user.first_name or user.username}!')
            if not user.is_setup_complete:
                return redirect('profile_setup')
            return redirect('home')
        else:
            messages.error(request, 'Invalid username or password.')
    else:
        form = LoginForm()

    return render(request, 'accounts/login.html', {'form': form})


def logout_view(request):
    """Handle user logout."""
    logout(request)
    messages.info(request, 'You have been logged out successfully.')
    return redirect('login')


@login_required
def home_view(request):
    """Home page - redirect to setup if incomplete."""
    if not request.user.is_setup_complete:
        return redirect('profile_setup')
    
    active_sos = SOSAlert.objects.filter(user=request.user, is_active=True).first()
    recent_reports = CommunityReport.objects.all()[:3]
    safety_zones = SafetyZone.objects.all()
    
    return render(request, 'accounts/home.html', {
        'active_sos': active_sos,
        'recent_reports': recent_reports,
        'safety_zones': safety_zones
    })


@login_required
def profile_setup_view(request):
    """Multi-step profile setup."""
    user = request.user
    step = int(request.GET.get('step', 1))
    
    if user.is_setup_complete and step == 1:
        return redirect('home')

    if step == 1:
        if request.method == 'POST':
            form = ProfileDetailsForm(request.POST, request.FILES, instance=user)
            if form.is_valid():
                form.save()
                return redirect('/accounts/profile-setup/?step=2')
        else:
            form = ProfileDetailsForm(instance=user)
        return render(request, 'accounts/profile_setup.html', {'form': form, 'step': 1})

    elif step == 2:
        contacts = EmergencyContact.objects.filter(user=user)
        if request.method == 'POST':
            if 'finish' in request.POST:
                user.is_setup_complete = True
                user.save()
                messages.success(request, "Setup complete! Your safety profile is ready.")
                return redirect('home')

            form = EmergencyContactSetupForm(request.POST)
            if form.is_valid():
                contact = form.save(commit=False)
                contact.user = user
                contact.save()
                return redirect('/accounts/profile-setup/?step=2')
        else:
            form = EmergencyContactSetupForm()
        return render(request, 'accounts/profile_setup.html', {
            'form': form, 
            'contacts': contacts, 
            'step': 2
        })

    return redirect('home')


@login_required
@require_POST
def sos_activate(request):
    """API: Activate SOS — uses service layer."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        data = {}

    latitude = data.get('latitude')
    longitude = data.get('longitude')
    image = request.FILES.get('image') # Handle multipart if sent
    audio = request.FILES.get('audio')

    sos, token = SOSService.trigger_sos(request.user, latitude, longitude, image=image, audio=audio)

    # Dynamic base URL for the tracking link
    base_url = request.build_absolute_uri('/')[:-1]
    tracking_url = f"{base_url}/track/{token}/"

    return JsonResponse({
        'status': 'ok',
        'sos_id': sos.id,
        'token': str(token),
        'tracking_url': tracking_url,
        'timestamp': sos.timestamp.isoformat(),
    })


@login_required
@require_POST
def sos_upload_media(request):
    """API: Upload audio/video evidence for SOS."""
    if 'media' not in request.FILES:
        return JsonResponse({'status': 'error', 'message': 'No media file provided.'}, status=400)
    
    # Get the latest active SOS alert for the user
    sos = SOSAlert.objects.filter(user=request.user, is_active=True).order_by('-timestamp').first()
    if sos:
        # Save the uploaded media file
        sos.media_evidence = request.FILES['media']
        sos.save()
        return JsonResponse({'status': 'ok', 'message': 'Media uploaded successfully.'})
    
    return JsonResponse({'status': 'error', 'message': 'No active SOS alert found.'}, status=404)


@login_required
@require_POST
def sos_deactivate(request):
    """API: Deactivate SOS — uses service layer."""
    updated = SOSService.deactivate_sos(request.user)
    # Stop tracking session
    LocationService.stop_tracking_session(request.user)
    
    return JsonResponse({'status': 'ok', 'deactivated': updated})


@login_required
def emergency_contacts_view(request):
    """List emergency contacts and handle adding new ones."""
    if not request.user.is_setup_complete:
        return redirect('profile_setup')
    if request.method == 'POST':
        form = EmergencyContactForm(request.POST)
        if form.is_valid():
            contact = form.save(commit=False)
            contact.user = request.user
            contact.save()
            messages.success(request, f'{contact.contact_name} added to your emergency contacts.')
            return redirect('emergency_contacts')
        else:
            messages.error(request, 'Please correct the errors below.')
    else:
        form = EmergencyContactForm()

    contacts = EmergencyContact.objects.filter(user=request.user)
    return render(request, 'accounts/emergency_contacts.html', {
        'form': form,
        'contacts': contacts,
    })


@login_required
@require_POST
def delete_emergency_contact(request, contact_id):
    """Delete an emergency contact (only if owned by the user)."""
    contact = get_object_or_404(EmergencyContact, id=contact_id, user=request.user)
    name = contact.contact_name
    contact.delete()
    messages.success(request, f'{name} removed from your emergency contacts.')

    referer = request.META.get('HTTP_REFERER')
    if referer:
        return redirect(referer)
    return redirect('emergency_contacts')


@login_required
def community_reports_view(request):
    """List community reports and handle submitting new ones."""
    if not request.user.is_setup_complete:
        return redirect('profile_setup')
    if request.method == 'POST':
        form = CommunityReportForm(request.POST)
        if form.is_valid():
            report = form.save(commit=False)
            report.user = request.user
            report.save()
            messages.success(request, 'Your report has been submitted. Thank you for keeping the community safe!')
            return redirect('community_reports')
        else:
            messages.error(request, 'Please correct the errors below.')
    else:
        form = CommunityReportForm()

    reports = CommunityReport.objects.all()
    return render(request, 'accounts/community_reports.html', {
        'form': form,
        'reports': reports,
    })


@login_required
def safe_route_view(request):
    """Safe Route — input destination, compute safety score, show color-coded result."""
    if not request.user.is_setup_complete:
        return redirect('profile_setup')
    destination = request.GET.get('destination', '').strip()
    route_data = None

    if destination:
        # Count reports by type for this area
        matching_reports = CommunityReport.objects.filter(
            location__icontains=destination
        )

        report_counts = {}
        for report in matching_reports:
            report_counts[report.report_type] = report_counts.get(report.report_type, 0) + 1

        # Use the reusable safety scoring function
        safety = SafetyService.calculate_score(report_counts)

        # Generate AI-like advisory (rule-based)
        advisory = SafetyService.generate_advisory(safety, report_counts, destination)

        route_data = {
            'destination': destination,
            'score': safety['score'],
            'color': safety['color'],
            'label': safety['label'],
            'is_night': safety['is_night'],
            'report_count': matching_reports.count(),
            'advisory': advisory,
        }

    return render(request, 'accounts/safe_route.html', {
        'route_data': route_data,
        'destination': destination,
    })


@login_required
@require_POST
def calculate_safety_api(request):
    """API: Calculate safety score using SafetyService."""
    try:
        data = json.loads(request.body)
        reports = data.get('reports', {})
        current_hour = data.get('current_hour')

        result = SafetyService.calculate_score(reports, current_hour=current_hour)

        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
@require_POST
def ai_analysis_api(request):
    """API: Route safety analysis via AIService."""
    try:
        data = json.loads(request.body)
        start_location = data.get('start_location', 'Current Location')
        destination = data.get('destination', 'Unknown')
        time_of_day = data.get('time', 'Night' if timezone.localtime().hour >= 18 else 'Day')

        # Fetch reports
        reports = list(CommunityReport.objects.all().order_by('-timestamp')[:50])

        result = AIService.analyze_route_safety(
            start_location=start_location,
            destination=destination,
            time_of_day=time_of_day,
            reports_data=reports
        )

        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@require_POST
def save_location_api(request):
    """API: Save user's current live location using LocationService."""
    try:
        data = json.loads(request.body)
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        speed = data.get('speed')
        
        if latitude is not None and longitude is not None:
            point = LocationService.update_user_location(
                request.user, 
                float(latitude), 
                float(longitude), 
                speed=speed
            )
            return JsonResponse({'status': 'ok', 'point_id': point.id})
        return JsonResponse({'error': 'Invalid coordinates'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
def live_track_view(request):
    """Live GPS tracking page with real-time map."""
    if not request.user.is_setup_complete:
        return redirect('profile_setup')
    safety_zones = SafetyZone.objects.all()
    
    active_session = TrackingSession.objects.filter(user=request.user, is_active=True).first()
    active_sos = SOSAlert.objects.filter(user=request.user, is_active=True).first()
    
    history_points = LocationHistory.objects.filter(user=request.user).order_by('-timestamp')[:50]
    history_data = []
    for pt in reversed(history_points):
        history_data.append({
            'lat': float(pt.latitude),
            'lng': float(pt.longitude),
            'speed': pt.speed if pt.speed else 0,
            'time': pt.timestamp.isoformat()
        })
        
    return render(request, 'accounts/live_track.html', {
        'safety_zones': safety_zones,
        'active_session': active_session,
        'active_sos': active_sos,
        'history_data_json': json.dumps(history_data),
    })


@login_required
def nearby_places_view(request):
    """Nearby safe places — police, hospitals, fire stations via Google Places API."""
    if not request.user.is_setup_complete:
        return redirect('profile_setup')
    return render(request, 'accounts/nearby_places.html')


@login_required
def api_reports(request):
    """API: Return all community reports & safety zones as JSON for map overlays."""
    reports = CommunityReport.objects.all().order_by('-timestamp')[:100]
    zones = SafetyZone.objects.all()

    reports_data = []
    for r in reports:
        if r.latitude and r.longitude:
            reports_data.append({
                'lat': float(r.latitude),
                'lng': float(r.longitude),
                'type': r.report_type,
                'type_display': r.get_report_type_display(),
                'severity': r.severity,
                'location': r.location,
                'description': r.description or '',
                'user': r.user.first_name or r.user.username,
                'time': str(r.timestamp),
            })

    zones_data = []
    for z in zones:
        zones_data.append({
            'lat': float(z.latitude),
            'lng': float(z.longitude),
            'name': z.name,
            'zone_type': z.zone_type,
            'zone_type_display': z.get_zone_type_display(),
            'radius': z.radius_meters,
            'description': z.description or '',
        })

    return JsonResponse({'reports': reports_data, 'zones': zones_data})

def track_user_view(request, token):
    """View to track another user's live location using a secure token."""
    session = LocationService.get_session_by_token(token)
    if not session:
        return render(request, 'accounts/track_user.html', {
            'error': 'This tracking session is inactive or has expired.'
        })
        
    return render(request, 'accounts/track_user.html', {
        'target_user': session.user,
        'session_token': token,
        'sos_alert': session.sos_alert,
    })

def get_location_api(request, token):
    """API: Fetch the latest location using a secure tracking token."""
    latest = LocationService.get_latest_point_by_token(token)
    if not latest:
        return JsonResponse({
            'status': 'error', 
            'message': 'No active location data for this token.'
        }, status=403)
        
    return JsonResponse({
        'status': 'ok',
        'latitude': latest['latitude'],
        'longitude': latest['longitude'],
        'timestamp': latest['timestamp'].isoformat()
    })
