from django.utils import timezone
from accounts.models import SOSAlert, EmergencyContact
from django.conf import settings
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
import logging

logger = logging.getLogger(__name__)

class SOSService:
    @staticmethod
    def trigger_sos(user, latitude, longitude, image=None, audio=None, send_twilio_sms=True):
        """Activates SOS, saves media, starts a tracking session, and notifies contacts."""
        from accounts.services.location_service import LocationService
        
        # Deactivate any existing active SOS records
        SOSAlert.objects.filter(user=user, is_active=True).update(
            is_active=False, deactivated_at=timezone.now()
        )

        # Create new SOS alert with media
        sos = SOSAlert.objects.create(
            user=user,
            latitude=latitude,
            longitude=longitude,
            image=image,
            audio=audio,
            status='triggered'
        )

        # 🚀 Start a secure tracking session linked to this SOS
        session = LocationService.start_tracking_session(user, sos_alert=sos)
        
        # Send notifications with the secure tracking link
        if send_twilio_sms:
            SOSService.notify_emergency_contacts(sos, session.token)
        
        return sos, session.token

    @staticmethod
    def notify_emergency_contacts(sos, token):
        """Sends notifications (FCM push + optional SMS) to the user's emergency contacts."""
        from accounts.services.fcm_service import FCMService

        user = sos.user
        contacts = EmergencyContact.objects.filter(user=user)
        
        if not contacts.exists():
            sos.status = 'failed'
            sos.failure_reason = "No emergency contacts found."
            sos.save()
            return

        # Prepare tracking URL
        display_name = user.first_name or user.username.split('@')[0].capitalize()
        base_url = getattr(settings, 'SITE_URL', 'http://192.168.1.6:8000').rstrip('/')
        tracking_url = f"{base_url}/track/{token}/"

        # 1. Send FCM push notifications (to contacts who have the app installed)
        fcm_count = FCMService.notify_contacts_via_fcm(sos, tracking_url)
        logger.info('[SOS] FCM push sent to %d contact(s).', fcm_count)

        # 2. Send Twilio SMS (covers contacts who don't have the app)
        sms_body = (
            f"🚨 EMERGENCY ALERT 🚨\n"
            f"{display_name} is in DANGER!\n"
            f"Live Tracking: {tracking_url}\n"
            f"Call 112 immediately! - Sakthi Safety"
        )

        account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', None)
        auth_token_twilio = getattr(settings, 'TWILIO_AUTH_TOKEN', None)
        phone_from = getattr(settings, 'TWILIO_PHONE_NUMBER', None)

        if account_sid and auth_token_twilio and phone_from:
            try:
                client = Client(account_sid, auth_token_twilio)
                sms_count = 0
                for contact in contacts:
                    if SOSService._send_sms(client, phone_from, contact.phone_number, sms_body):
                        sms_count += 1
                
                sos.status = 'sent' if (fcm_count + sms_count) > 0 else 'failed'
                sos.save()
            except Exception as e:
                logger.error(f"Twilio initialization failed: {str(e)}")
                sos.status = 'failed' if fcm_count == 0 else 'sent'
                sos.failure_reason = str(e)
                sos.save()
        else:
            logger.warning("Twilio credentials not configured — FCM-only dispatch.")
            sos.status = 'sent' if fcm_count > 0 else 'failed'
            if fcm_count == 0:
                sos.failure_reason = "No FCM tokens and no Twilio credentials."
            sos.save()

    @staticmethod
    def _send_sms(client, from_phone, to_phone, body):
        """Helper to send SMS with formatting and error handling."""
        try:
            phone = to_phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
            if not phone.startswith('+'):
                if phone.startswith('0'): phone = '+91' + phone[1:]
                elif len(phone) == 10: phone = '+91' + phone
                else: phone = '+' + phone
            
            client.messages.create(body=body, from_=from_phone, to=phone)
            return True
        except TwilioRestException as e:
            logger.error(f"Twilio error sending to {to_phone}: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending SMS to {to_phone}: {str(e)}")
            return False

    @staticmethod
    def deactivate_sos(user):
        """Marks all active SOS alerts for a user as inactive (safe)."""
        return SOSAlert.objects.filter(user=user, is_active=True).update(
            is_active=False, 
            status='cancelled',
            deactivated_at=timezone.now()
        )
