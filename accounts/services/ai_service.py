from google import genai
import json
import logging
import hashlib
from django.conf import settings
from django.core.cache import cache
from django.db import models

logger = logging.getLogger(__name__)

class AIService:
    """Service to handle AI safety analysis via Google Gemini API."""

    @staticmethod
    def safety_assistant(user, message, latitude=None, longitude=None):
        """
        Gives short, practical safety guidance using user context and recent local reports.
        """
        from accounts.models import CommunityReport, EmergencyContact
        from django.utils import timezone
        import datetime

        contact_count = EmergencyContact.objects.filter(user=user).count()
        recent_threshold = timezone.now() - datetime.timedelta(days=30)
        reports = CommunityReport.objects.filter(timestamp__gte=recent_threshold)

        if latitude is not None and longitude is not None:
            radius = 0.045
            reports = reports.filter(
                latitude__gte=float(latitude) - radius,
                latitude__lte=float(latitude) + radius,
                longitude__gte=float(longitude) - radius,
                longitude__lte=float(longitude) + radius,
            )

        reports = reports.order_by('-timestamp')[:12]
        reports_text = AIService._format_reports(reports)

        api_key = getattr(settings, 'GEMINI_API_KEY', '')
        if not api_key:
            return AIService._assistant_fallback(message, contact_count, reports, reason="AI key missing.")

        prompt = f"""
        You are the AI safety assistant inside a women safety app.
        Give concise, practical, calm advice. Do not overstate certainty.
        If the user may be in immediate danger, tell them to use SOS/call emergency services first.

        User profile context:
        - Username: {getattr(user, 'username', 'user')}
        - Trusted emergency contacts saved: {contact_count}
        - Current coordinates if available: {latitude}, {longitude}

        Recent nearby/community safety reports:
        {reports_text}

        User question:
        {message}

        Return ONLY valid JSON:
        {{
          "risk_level": "low" | "medium" | "high",
          "answer": "2-4 short sentences",
          "recommended_actions": ["action 1", "action 2", "action 3"],
          "use_sos_now": true | false
        }}
        """

        try:
            client = genai.Client(api_key=api_key)
            response = AIService._generate_content(client, prompt)
            result = json.loads(AIService._clean_json_output(response.text))
            return {
                "risk_level": result.get("risk_level", "medium"),
                "answer": result.get("answer", "Stay alert and use SOS if you feel unsafe."),
                "recommended_actions": result.get("recommended_actions") or [
                    "Move toward a public, well-lit place.",
                    "Share your live location with a trusted contact.",
                    "Keep emergency calling ready.",
                ],
                "use_sos_now": bool(result.get("use_sos_now", False)),
                "source": "gemini",
                "context": {
                    "contacts_count": contact_count,
                    "nearby_reports_count": len(reports),
                },
            }
        except Exception as e:
            logger.error(f"AI Assistant Gemini Error: {str(e)}")
            return AIService._assistant_fallback(message, contact_count, reports, reason="Gemini service unavailable.")
    
    @staticmethod
    def analyze_route_safety(start_lat, start_lng, end_lat, end_lng, time_of_day):
        """
        Analyzes route safety based on coordinates, nearby community reports, and time.
        """
        # 1. Fetch relevant reports (within 5km of start or end, last 48h)
        from accounts.models import CommunityReport
        from django.utils import timezone
        import datetime
        
        recent_threshold = timezone.now() - datetime.timedelta(hours=48)
        
        # Simple bounding box approximation for 5km (~0.045 degrees)
        RADIUS = 0.045 
        
        reports = CommunityReport.objects.filter(
            timestamp__gte=recent_threshold
        ).filter(
            (
                # Near start point
                models.Q(latitude__gte=float(start_lat)-RADIUS, latitude__lte=float(start_lat)+RADIUS) &
                models.Q(longitude__gte=float(start_lng)-RADIUS, longitude__lte=float(start_lng)+RADIUS)
            ) | (
                # Near end point
                models.Q(latitude__gte=float(end_lat)-RADIUS, latitude__lte=float(end_lat)+RADIUS) &
                models.Q(longitude__gte=float(end_lng)-RADIUS, longitude__lte=float(end_lng)+RADIUS)
            )
        )[:30]

        # 2. Cache handling
        cache_input = f"{start_lat}-{start_lng}-{end_lat}-{end_lng}-{time_of_day}"
        cache_key = f"ai_route_{hashlib.md5(cache_input.encode()).hexdigest()}"
        
        cached_result = cache.get(cache_key)
        if cached_result:
            return cached_result

        reports_text = AIService._format_reports(reports)
        
        # 3. Gemini Call
        api_key = getattr(settings, 'GEMINI_API_KEY', '')
        if not api_key:
            return AIService._get_fallback_response("API key missing.")

        client = genai.Client(api_key=api_key)

        prompt = f"""
        Analyze safety of travel from ({start_lat}, {start_lng}) to ({end_lat}, {end_lng}) at {time_of_day}.
        
        Nearby Incidents (last 48h):
        {reports_text}
        
        Task:
        1. Evaluate overall risk (0-100).
        2. Assign Safety level.
        3. Explain context and provide 3 safety suggestions.

        Return ONLY valid JSON:
        {{
          "safety_level": "Safe" | "Moderate" | "Risk",
          "risk_score": 0-100,
          "explanation": "string",
          "suggestions": ["string", "string", "string"]
        }}
        """

        try:
            response = AIService._generate_content(client, prompt)
            text = AIService._clean_json_output(response.text)
            result = json.loads(text)
            
            cache.set(cache_key, result, 600)
            return result
        except Exception as e:
            logger.error(f"AI Gemini Error: {str(e)}")
            return AIService._get_fallback_response("Analysis service currently overwhelmed.")

    @staticmethod
    def _format_reports(reports):
        if not reports:
            return "No recent incidents reported in this specific radius."
        lines = []
        for r in reports:
            lines.append(f"- {r.get_report_type_display()} at ({r.latitude}, {r.longitude}): {r.description or 'No details'}")
        return "\n".join(lines)

    @staticmethod
    def _generate_content(client, prompt):
        """
        Try multiple Gemini model names so older/local setups keep working if one model is unavailable.
        """
        last_error = None
        for model in ("gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"):
            try:
                return client.models.generate_content(model=model, contents=prompt)
            except Exception as exc:
                last_error = exc
        raise last_error

    @staticmethod
    def _clean_json_output(text):
        """Removes markdown backticks from AI output."""
        text = text.strip()
        if text.startswith("```json"): text = text[7:]
        elif text.startswith("```"): text = text[3:]
        if text.endswith("```"): text = text[:-3]
        return text.strip()

    @staticmethod
    def _get_fallback_response(reason):
        return {
            "safety_level": "Moderate",
            "risk_score": 50,
            # Marks that the AI score is not real, so the route view scores from
            # local data + time-of-day instead of letting this flat 50 set the
            # floor (which made every route show as a Yellow Zone).
            "is_fallback": True,
            "explanation": f"Using baseline safety metrics. {reason}",
            "suggestions": ["Share your live location.", "Avoid deserted shortcuts.", "Keep emergency contacts ready."]
        }

    @staticmethod
    def _assistant_fallback(message, contact_count, reports, reason="Using local safety guidance."):
        nearby_count = len(reports)
        text = (message or "").lower()
        danger_words = ["following", "followed", "threat", "harass", "attack", "scared", "unsafe", "danger", "emergency"]
        night_words = ["night", "dark", "alone", "isolated", "empty", "late"]
        immediate_risk = any(word in text for word in danger_words)
        caution_risk = any(word in text for word in night_words) or nearby_count >= 2
        use_sos = immediate_risk or nearby_count >= 3

        if immediate_risk:
            risk_level = "high"
            answer = "Treat this as urgent. Move toward people, shops, security, or a main road now, and use SOS if you cannot quickly reach safety."
            actions = [
                "Trigger SOS now if the person is close or you feel threatened.",
                "Call a trusted contact and keep them on the line.",
                "Avoid going home directly if someone is following you.",
            ]
        elif caution_risk:
            risk_level = "medium"
            answer = "Use extra caution for this situation. Prefer a busy, well-lit route and share your live location before continuing."
            actions = [
                "Share live tracking with a trusted contact.",
                "Stay on main roads and avoid shortcuts.",
                "Keep SOS ready until you reach a safe place.",
            ]
        else:
            risk_level = "low"
            answer = "No urgent danger is obvious from your message, but stay aware. Keep your phone reachable and use the app tools if the situation changes."
            actions = [
                "Keep emergency contacts updated.",
                "Check Safe Route before travelling.",
                "Use Safety Timer if you are travelling alone.",
            ]

        if contact_count == 0:
            risk_level = "high" if risk_level == "medium" else risk_level
            actions.insert(0, "Add at least one emergency contact before relying on SOS SMS.")

        return {
            "risk_level": risk_level,
            "answer": answer,
            "recommended_actions": actions[:4],
            "use_sos_now": use_sos,
            "source": "local_fallback",
            "context": {
                "contacts_count": contact_count,
                "nearby_reports_count": nearby_count,
                "note": reason,
            },
        }
