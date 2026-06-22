"""
fcm_service.py
Firebase Cloud Messaging wrapper for the Sakthi Safety App.
Uses the firebase-admin SDK to send push notifications to Android/iOS devices.

SETUP REQUIRED:
  1. Install: pip install firebase-admin
  2. Download serviceAccountKey.json from Firebase Console
     (Project Settings → Service accounts → Generate new private key)
  3. Place it at: <Django project root>/serviceAccountKey.json
  4. Set FCM_SERVICE_ACCOUNT_KEY in settings.py:
       FCM_SERVICE_ACCOUNT_KEY = BASE_DIR / 'serviceAccountKey.json'
"""

import logging
import os

from django.conf import settings

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK once (module-level singleton)
_firebase_app = None


def _get_firebase_app():
    """Lazily initialises the Firebase Admin SDK. Returns the app or None."""
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    try:
        import json

        import firebase_admin
        from firebase_admin import credentials

        # Prefer the env-provided JSON (used on hosts like Render where the key
        # file isn't committed); fall back to the local serviceAccountKey.json.
        key_json = getattr(settings, 'FCM_SERVICE_ACCOUNT_JSON', '')
        key_path = getattr(settings, 'FCM_SERVICE_ACCOUNT_KEY', None)

        if key_json:
            cred = credentials.Certificate(json.loads(key_json))
        elif key_path and os.path.exists(str(key_path)):
            cred = credentials.Certificate(str(key_path))
        else:
            logger.warning(
                '[FCM] No Firebase credentials found (FIREBASE_SERVICE_ACCOUNT_JSON '
                'env var or serviceAccountKey.json at %s). Push notifications disabled.',
                key_path,
            )
            return None

        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info('[FCM] Firebase Admin SDK initialised successfully.')
        return _firebase_app

    except ImportError:
        logger.error('[FCM] firebase-admin is not installed. Run: pip install firebase-admin')
        return None
    except Exception as e:
        logger.error('[FCM] Failed to initialise Firebase Admin SDK: %s', str(e))
        return None


class FCMService:
    """Sends Firebase Cloud Messaging push notifications."""

    @staticmethod
    def send_sos_push(token: str, sender_name: str, tracking_url: str) -> bool:
        """
        Sends an SOS push notification to a single device.

        Args:
            token:        FCM registration token for the target device.
            sender_name:  Display name of the person who triggered SOS.
            tracking_url: Secure live-tracking URL to include in the alert.

        Returns:
            True if the message was accepted by FCM, False otherwise.
        """
        app = _get_firebase_app()
        if app is None:
            return False

        try:
            from firebase_admin import messaging

            message = messaging.Message(
                notification=messaging.Notification(
                    title='🚨 SOS ALERT',
                    body=f'{sender_name} is in DANGER! Tap to track live.',
                ),
                data={
                    'type': 'sos_alert',
                    'sender_name': sender_name,
                    'tracking_url': tracking_url,
                },
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        sound='default',
                        channel_id='sakthi_sos',
                        priority='max',
                        visibility='public',
                    ),
                ),
                token=token,
            )

            response = messaging.send(message)
            logger.info('[FCM] SOS push sent to token ...%s: %s', token[-6:], response)
            return True

        except Exception as e:
            logger.error('[FCM] Failed to send push to token ...%s: %s', token[-6:], str(e))
            return False

    @staticmethod
    def notify_contacts_via_fcm(sos_alert, tracking_url: str) -> int:
        """
        Sends FCM SOS push notifications to all emergency contacts of the
        SOS user who have a registered FCM token.

        Args:
            sos_alert:    SOSAlert model instance (with .user FK).
            tracking_url: Live tracking URL to embed in the notification.

        Returns:
            Number of successfully dispatched push notifications.
        """
        from accounts.models import EmergencyContact

        user = sos_alert.user
        display_name = user.first_name or user.username.split('@')[0].capitalize()

        # Find all emergency contacts and look up their user accounts (if any)
        contacts = EmergencyContact.objects.filter(user=user).select_related()

        success_count = 0

        # Also try to notify the user's account (if they are a registered user)
        # by matching phone numbers to CustomUser fcm_tokens
        from django.contrib.auth import get_user_model
        User = get_user_model()

        for contact in contacts:
            # Try to find a registered user whose phone matches this contact
            try:
                contact_user = User.objects.filter(
                    phone_number=contact.phone_number
                ).exclude(fcm_token__isnull=True).exclude(fcm_token='').first()

                if contact_user and contact_user.fcm_token:
                    sent = FCMService.send_sos_push(
                        token=contact_user.fcm_token,
                        sender_name=display_name,
                        tracking_url=tracking_url,
                    )
                    if sent:
                        success_count += 1
                else:
                    logger.debug(
                        '[FCM] Contact %s has no registered FCM token — '
                        'fallback to SMS will cover this.',
                        contact.phone_number,
                    )
            except Exception as e:
                logger.error('[FCM] Error processing contact %s: %s', contact.phone_number, e)

        logger.info('[FCM] SOS push sent to %d/%d contacts.', success_count, contacts.count())
        return success_count
