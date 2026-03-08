from pydantic import BaseModel, field_validator


class LoginInput(BaseModel):
    email: str
    password: str
    tenant_id: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        local_part, separator, domain = normalized.partition("@")

        if not separator or not local_part or not domain or "." not in domain:
            raise ValueError("value is not a valid email address")

        return normalized


class RefreshInput(BaseModel):
    refresh_token: str


class LogoutInput(BaseModel):
    refresh_token: str


class TokenOutput(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LogoutOutput(BaseModel):
    status: str
