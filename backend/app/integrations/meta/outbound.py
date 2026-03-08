from __future__ import annotations

import httpx

from app.core.config import get_settings

settings = get_settings()


class RetriableProviderError(Exception):
    pass


class NonRetriableProviderError(Exception):
    pass


class MetaOutboundClient:
    def _post(self, url: str, token: str, payload: dict) -> dict:
        if not url or not token:
            # Local fallback for MVP when provider credentials are not configured.
            return {"status": "sent", "provider_message_id": f"sim_{payload.get('conversation_id', 'msg')}"}

        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        with httpx.Client(timeout=10.0) as client:
            response = client.post(url, json=payload, headers=headers)

        if response.status_code in {429, 500, 502, 503, 504}:
            raise RetriableProviderError(f"Provider temporary failure: {response.status_code}")
        if response.status_code >= 400:
            raise NonRetriableProviderError(f"Provider rejected request: {response.status_code}")
        return response.json() if response.content else {"status": "sent"}

    def send_whatsapp(self, payload: dict) -> dict:
        return self._post(settings.whatsapp_api_url, settings.whatsapp_api_token, payload)

    def send_instagram(self, payload: dict) -> dict:
        return self._post(settings.instagram_api_url, settings.instagram_api_token, payload)
