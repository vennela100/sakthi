import os
import django


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "authproject.settings")
    django.setup()

    from django.test import Client
    from accounts.models import CustomUser

    user, _ = CustomUser.objects.get_or_create(username="test_user_69")
    user.set_password("pass")
    user.save()

    client = Client()
    client.login(username="test_user_69", password="pass")
    response = client.get("/safe-route/")
    print("Status Code:", response.status_code)
    html = response.content.decode("utf-8")
    expected_key = os.getenv("GOOGLE_MAPS_API_KEY", "")

    if expected_key and expected_key in html:
        print("API Key is successfully injected in HTML (/safe-route/).")
    else:
        print("API Key IS NOT injected in HTML. Let's find out why.")
        if "maps.googleapis.com" in html:
            print("Google Maps script tag found but no API key.")
        else:
            print("Google maps URL is not even in the HTML.")
            print(html[:500])


if __name__ == "__main__":
    main()
