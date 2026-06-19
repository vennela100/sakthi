from django.utils import timezone

class SafetyService:
    @staticmethod
    def calculate_score(report_counts, current_hour=None):
        """
        Calculates a safety score (0-100) based on report counts.
        """
        score = 100
        DEDUCTIONS = {
            'harassment': 15,
            'suspicious_activity': 10,
            'dark_area': 8,
        }

        for report_type, penalty in DEDUCTIONS.items():
            count = report_counts.get(report_type, 0)
            score -= penalty * count

        if current_hour is None:
            current_hour = timezone.localtime().hour

        is_night = current_hour >= 20 or current_hour < 6
        if is_night:
            score -= 20

        score = max(0, min(100, score))
        
        if score >= 70:
            color, label = 'green', 'Safe'
        elif score >= 40:
            color, label = 'yellow', 'Moderate'
        else:
            color, label = 'red', 'Unsafe'

        return {
            'score': score,
            'color': color,
            'label': label,
            'is_night': is_night,
        }

    @staticmethod
    def generate_advisory(safety_result, report_counts, destination=''):
        """
        Generates human-readable warnings and suggestions.
        """
        color = safety_result['color']
        score = safety_result['score']
        is_night = safety_result['is_night']

        warnings = []
        suggestions = []

        if color == 'red':
            alert_level = 'danger'
            alert_title = '⚠️ High Risk Area'
            warnings.append(f'"{destination}" has a low safety score ({score}/100).')
            suggestions.append('Avoid this area if possible.')
        elif color == 'yellow':
            alert_level = 'warning'
            alert_title = '⚡ Caution'
            warnings.append(f'"{destination}" has moderate risk ({score}/100).')
            suggestions.append('Stay alert and keep your phone ready.')
        else:
            alert_level = 'safe'
            alert_title = '✅ Safe Area'
            suggestions.append('Standard safety precautions apply.')

        # Specific report warnings
        if report_counts.get('harassment', 0) > 0:
            warnings.append(f"{report_counts['harassment']} harassment reports found.")
        if report_counts.get('dark_area', 0) > 0:
            warnings.append("Reports of poor lighting in this area.")

        if is_night:
            warnings.append('Nighttime increases travel risks.')

        return {
            'alert_level': alert_level,
            'alert_title': alert_title,
            'warnings': warnings,
            'suggestions': suggestions,
        }
