import os
import django


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "authproject.settings")
    django.setup()

    from django.test import Client
    from accounts.models import CustomUser

    user = CustomUser.objects.first()
    if user is None:
        user = CustomUser.objects.create_user(username="test_user_69", password="pass")

    client = Client()
    client.force_login(user)

    response = client.post(
        "/api/v1/analyze-route/",
        {
            "start_lat": 17.3850,
            "start_lng": 78.4867,
            "end_lat": 17.4100,
            "end_lng": 78.4900,
            "time": "now",
        },
        content_type="application/json",
    )

    print("Status Code:", response.status_code)
    try:
        print("Response body:", response.json())
    except ValueError:
        print("Failed to decode JSON. Raw text:", response.content)


if __name__ == "__main__":
    main()
