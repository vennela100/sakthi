from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.views.static import serve

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('allauth.urls')),
    path('api/v1/', include('accounts.api.urls')),
    path('', include('accounts.urls')),
]

# Serve user-uploaded media (SOS evidence photos/audio) even when DEBUG is False.
# NOTE: the django.conf.urls.static.static() helper short-circuits to an empty
# list whenever DEBUG is False, so on Render (DEBUG=False) it served nothing and
# every /media/ evidence URL 404'd. We wire the serve view explicitly instead so
# it works in production too. When Cloudinary is configured these files live at
# absolute Cloudinary URLs and bypass this route entirely; this only matters for
# local-disk storage.
if not getattr(settings, 'USE_CLOUDINARY', False):
    media_prefix = settings.MEDIA_URL.lstrip('/')
    urlpatterns += [
        re_path(rf'^{media_prefix}(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]
