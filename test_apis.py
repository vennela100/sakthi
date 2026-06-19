import os
import django


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "authproject.settings")
    django.setup()

    from accounts.models import CustomUser, CommunityReport
    from accounts.services.ai_service import AIService
    from accounts.services.location_service import LocationService
    from accounts.services.sos_service import SOSService

    print("--- TESTING MODELS & SERVICES ---")
    user, _ = CustomUser.objects.get_or_create(
        username="test_user_69",
        email="test@sakthi.com",
    )
    user.set_password("pass")
    user.save()

    print("User ready:", user.username)

    try:
        sos, token = SOSService.trigger_sos(user, 17.3850, 78.4867)
        print(f"SOS Triggered: ID {sos.id}, Token {token}")

        session = LocationService.get_session_by_token(token)
        print("Tracking Session active:", session.is_active)
    except Exception as exc:
        print("Failed SOS Trigger:", exc)

    try:
        CommunityReport.objects.get_or_create(
            user=user,
            report_type="harassment",
            severity="high",
            location="Test Danger Area",
            latitude=17.4000,
            longitude=78.4800,
            description="Testing AI Context",
        )
        print("Community Report ready")
    except Exception as exc:
        print("Failed attaching report:", exc)

    print("Testing AI Route Safety (this hits Gemini)...")
    try:
        ai_res = AIService.analyze_route_safety(
            17.3850,
            78.4867,
            17.4100,
            78.4900,
            "night",
        )
        print("AI Response:")
        import json

        print(json.dumps(ai_res, indent=2))
    except Exception as exc:
        print("AI Service failed:", exc)

    print("--- TESTING COMPLETE ---")


if __name__ == "__main__":
    main()
