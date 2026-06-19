import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "authproject.settings")
django.setup()

from accounts.models import CustomUser, CommunityReport

def run_script():
    print("--- INSERTING COMMUNITY REPORTS ---")
    user, created = CustomUser.objects.get_or_create(username='test_community_user', email='community@sakthi.com')
    if created:
        user.set_password('pass123')
        user.save()
        print("User created:", user.username)
    else:
        print("User already exists:", user.username)

    reports = [
        {
            'report_type': 'harassment',
            'severity': 'high',
            'location': 'Central Park South Entrance',
            'latitude': 40.7644,
            'longitude': -73.9745,
            'description': 'Suspicious group loitering and harassing passersby.'
        },
        {
            'report_type': 'dark_area',
            'severity': 'medium',
            'location': '5th Ave & 34th St, Alleyway',
            'latitude': 40.7484,
            'longitude': -73.9857,
            'description': 'Streetlights are broken in this section, very dark at night.'
        },
        {
            'report_type': 'suspicious_activity',
            'severity': 'low',
            'location': 'Downtown Station',
            'latitude': 40.7128,
            'longitude': -74.0060,
            'description': 'Unattended baggage left near the entrance.'
        }
    ]

    for data in reports:
        report, created = CommunityReport.objects.get_or_create(
            user=user,
            report_type=data['report_type'],
            severity=data['severity'],
            location=data['location'],
            latitude=data['latitude'],
            longitude=data['longitude'],
            description=data['description']
        )
        if created:
            print(f"Inserted report: {report.get_report_type_display()} at {report.location}")
        else:
            print(f"Report already exists: {report.get_report_type_display()} at {report.location}")

    print("\n--- TESTING RETRIEVAL ---")
    all_reports = CommunityReport.objects.all()
    print(f"Total community reports in database: {all_reports.count()}")
    for r in all_reports[:5]:
        print(f"- {r.get_report_type_display()} (Severity: {r.severity}) by {r.user.username} at {r.location}")

    print("\n--- TEST COMPLETE ---")

if __name__ == '__main__':
    run_script()
