from pydantic import BaseModel


class PaymentCreateResponse(BaseModel):
    confirmation_url: str
    payment_id: str
