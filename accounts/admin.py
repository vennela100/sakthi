from django.contrib import admin  # type: ignore
from django.contrib.auth.admin import UserAdmin  # type: ignore
from accounts.models import CustomUser, SOSAlert, EmergencyContact, CommunityReport, SafetyZone  # type: ignore


class CustomUserAdmin(UserAdmin):
    model = CustomUser
    list_display = ['username', 'first_name', 'phone_number', 'is_setup_complete', 'is_staff']
    fieldsets = UserAdmin.fieldsets + (
        ('Additional Info', {'fields': ('phone_number', 'is_setup_complete', 'home_address', 'work_address', 'profile_picture')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Additional Info', {'fields': ('phone_number',)}),
    )


@admin.register(SOSAlert)
class SOSAlertAdmin(admin.ModelAdmin):
    list_display = ['user', 'timestamp', 'latitude', 'longitude', 'is_active']
    list_filter = ['is_active', 'timestamp']
    readonly_fields = ['timestamp']


@admin.register(EmergencyContact)
class EmergencyContactAdmin(admin.ModelAdmin):
    list_display = ['user', 'contact_name', 'phone_number', 'relationship', 'created_at']
    list_filter = ['created_at']
    search_fields = ['contact_name', 'phone_number']


@admin.register(SafetyZone)
class SafetyZoneAdmin(admin.ModelAdmin):
    list_display = ['name', 'zone_type', 'latitude', 'longitude', 'radius_meters']
    list_filter = ['zone_type']
    search_fields = ['name', 'description']


try:
    admin.site.unregister(CustomUser)
except admin.sites.NotRegistered:
    pass
admin.site.register(CustomUser, CustomUserAdmin)


@admin.register(CommunityReport)
class CommunityReportAdmin(admin.ModelAdmin):
    list_display = ['user', 'report_type', 'location', 'timestamp']
    list_filter = ['report_type', 'timestamp']
    search_fields = ['location', 'description']
