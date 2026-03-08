from hashlib import sha256
import hmac

from app.core.config import get_settings

settings = get_settings()


def verify_meta_signature(raw_body: bytes, signature_header: str | None) -> bool:
    if not settings.meta_app_secret:
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False

    received = signature_header.split("=", 1)[1].strip()
    expected = hmac.new(settings.meta_app_secret.encode("utf-8"), raw_body, sha256).hexdigest()
    return hmac.compare_digest(expected, received)
