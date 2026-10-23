"""SSLCommerz hosted checkout. One gateway covers cards, bKash, Nagad, Rocket and net
banking in BDT, so Kothora does not integrate each wallet separately.

Flow: create a session -> the user pays on the gateway page -> SSLCommerz calls our IPN
and redirects the browser back -> we confirm with the validation API before granting
anything. The IPN and redirect bodies are never trusted on their own.
"""

from dataclasses import dataclass

import httpx


class PaymentGatewayError(Exception):
    pass


@dataclass(frozen=True)
class CheckoutRequest:
    tran_id: str
    amount_bdt: int
    product_name: str
    customer_name: str
    customer_email: str
    success_url: str
    fail_url: str
    cancel_url: str
    ipn_url: str


@dataclass(frozen=True)
class Validation:
    status: str  # VALID | VALIDATED | INVALID_TRANSACTION | ...
    tran_id: str
    amount: float
    currency: str
    card_type: str
    risk_level: int

    @property
    def is_paid(self) -> bool:
        return self.status in {"VALID", "VALIDATED"}


class SSLCommerzClient:
    def __init__(
        self, http: httpx.AsyncClient, base_url: str, store_id: str, store_password: str
    ) -> None:
        if not store_id or not store_password:
            raise ValueError("SSLCommerz store id and password are required")
        self._http = http
        self._base_url = base_url.rstrip("/")
        self._store_id = store_id
        self._store_password = store_password

    async def create_session(self, request: CheckoutRequest) -> str:
        """Return the hosted payment page URL to send the user to."""
        form = {
            "store_id": self._store_id,
            "store_passwd": self._store_password,
            "total_amount": f"{request.amount_bdt:.2f}",
            "currency": "BDT",
            "tran_id": request.tran_id,
            "success_url": request.success_url,
            "fail_url": request.fail_url,
            "cancel_url": request.cancel_url,
            "ipn_url": request.ipn_url,
            "cus_name": request.customer_name,
            "cus_email": request.customer_email,
            # The gateway requires these fields; a digital subscription has no address.
            "cus_add1": "N/A",
            "cus_city": "Dhaka",
            "cus_country": "Bangladesh",
            "cus_phone": "N/A",
            "shipping_method": "NO",
            "num_of_item": 1,
            "product_name": request.product_name,
            "product_category": "Subscription",
            "product_profile": "non-physical-goods",
        }
        data = await self._request("POST", "/gwprocess/v4/api.php", data=form)
        gateway_url = data.get("GatewayPageURL")
        if data.get("status") != "SUCCESS" or not gateway_url:
            reason = data.get("failedreason") or data.get("status") or "unknown error"
            raise PaymentGatewayError(f"SSLCommerz refused the session: {reason}")
        return gateway_url

    async def validate(self, val_id: str) -> Validation:
        data = await self._request(
            "GET",
            "/validator/api/validationserverAPI.php",
            params={
                "val_id": val_id,
                "store_id": self._store_id,
                "store_passwd": self._store_password,
                "v": 1,
                "format": "json",
            },
        )
        try:
            return Validation(
                status=str(data.get("status", "")),
                tran_id=str(data.get("tran_id", "")),
                amount=float(data.get("amount") or 0),
                currency=str(data.get("currency", "")),
                card_type=str(data.get("card_type", "")),
                risk_level=int(data.get("risk_level") or 0),
            )
        except (TypeError, ValueError) as exc:
            raise PaymentGatewayError(f"Unexpected validation response: {data}") from exc

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        try:
            response = await self._http.request(
                method, self._base_url + path, timeout=30.0, **kwargs
            )
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise PaymentGatewayError(f"SSLCommerz {path}: {exc}") from exc
