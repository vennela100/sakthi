from django.db.models.signals import post_delete
from django.dispatch import receiver

from accounts.models import SOSAlert


@receiver(post_delete, sender=SOSAlert)
def delete_sos_media_files(sender, instance, **kwargs):
    for media_file in (instance.image, instance.audio):
        if media_file:
            media_file.delete(save=False)
