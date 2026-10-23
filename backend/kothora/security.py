"""Password hashing and JWT access tokens."""

from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from kothora.config import Settings

_JWT_ALGORITHM = "HS256"
# bcrypt ignores everything past 72 bytes; reject longer passwords instead of silently truncating.
MAX_PASSWORD_BYTES = 72


class InvalidTokenError(Exception):
    pass


def hash_password(password: str) -> str:
    encoded = password.encode()
    if len(encoded) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes")
    return bcrypt.hashpw(encoded, bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    encoded = password.encode()
    if len(encoded) > MAX_PASSWORD_BYTES:
        return False
    return bcrypt.checkpw(encoded, password_hash.encode())


def create_access_token(user_id: str, settings: Settings) -> str:
    now = datetime.now(UTC)
    claims = {"sub": user_id, "iat": now, "exp": now + timedelta(minutes=settings.jwt_ttl_minutes)}
    return jwt.encode(claims, settings.jwt_secret, algorithm=_JWT_ALGORITHM)


def decode_access_token(token: str, settings: Settings) -> str:
    """Return the user id in the token, or raise InvalidTokenError."""
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[_JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise InvalidTokenError(str(exc)) from exc
    user_id = claims.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise InvalidTokenError("Token has no subject")
    return user_id
