from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import SOSAlert


class Command(BaseCommand):
    help = 'Delete SOS alerts and evidence media older than the retention period.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=30,
            help='Keep SOS evidence from this many days. Defaults to 30.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show how many records would be deleted without deleting them.',
        )

    def handle(self, *args, **options):
        days = options['days']
        if days < 1:
            raise ValueError('--days must be at least 1.')

        cutoff = timezone.now() - timedelta(days=days)
        queryset = SOSAlert.objects.filter(timestamp__lt=cutoff)
        count = queryset.count()

        if options['dry_run']:
            self.stdout.write(
                self.style.WARNING(
                    f'{count} SOS alert(s) older than {days} day(s) would be deleted.'
                )
            )
            return

        deleted, _ = queryset.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f'Deleted {count} SOS alert(s) older than {days} day(s); {deleted} total row(s) removed.'
            )
        )
