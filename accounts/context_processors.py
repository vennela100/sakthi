from django.conf import settings

def google_maps_api_key(request):
    """
    Injects the Google Maps API key into all templates context.
    """
    return {
        'GOOGLE_MAPS_API_KEY': getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
    }
