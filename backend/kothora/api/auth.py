from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from kothora.deps import CurrentUser, Services, Session
from kothora.models import User
from kothora.schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut
from kothora.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, session: Session, services: Services) -> TokenResponse:
    user = User(
        email=body.email.lower(), name=body.name.strip(), password_hash=hash_password(body.password)
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "That email is already registered") from exc
    return TokenResponse(access_token=create_access_token(user.id, services.settings))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, session: Session, services: Services) -> TokenResponse:
    result = await session.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()
    # Same message for unknown email and wrong password, so accounts cannot be probed.
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password")
    return TokenResponse(access_token=create_access_token(user.id, services.settings))


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> User:
    return user
