"""Request and response models.

Validation lives here rather than in the route bodies, so a malformed request is
rejected before it reaches any business logic — and the generated OpenAPI schema
documents the real contract rather than an approximation of it.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field, StringConstraints

Password = Annotated[str, StringConstraints(min_length=10, max_length=128)]
DisplayName = Annotated[str, StringConstraints(min_length=1, max_length=80, strip_whitespace=True)]


# --- Auth -------------------------------------------------------------------


class RegisterRequest(BaseModel):
    email: EmailStr
    display_name: DisplayName
    # 10 characters minimum. Length is the property that actually resists
    # guessing; composition rules mostly push users toward "Passw0rd!".
    password: Password


class LoginRequest(BaseModel):
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str


class AuthResponse(BaseModel):
    user: UserOut
    tokens: TokenPair


# --- Transactions -----------------------------------------------------------


class TransactionOut(BaseModel):
    id: int
    source_id: str
    occurred_at: datetime
    merchant: str
    category_slug: str
    category_label: str
    accent_hue: int
    amount: Decimal
    currency: str
    status: Literal["SUCCESS", "PENDING", "FAILED"]
    method: Literal["CREDIT_CARD", "DEBIT_CARD", "UPI", "NETBANKING"]
    is_anomalous: bool
    coins_earned: int


class AnomalyOut(BaseModel):
    kind: str
    original_value: str | None
    resolution: str


class TransactionDetailOut(TransactionOut):
    source_row_index: int
    anomalies: list[AnomalyOut]


class PageOut(BaseModel):
    rows: list[TransactionOut]
    page: int
    page_size: int
    total: int
    total_pages: int


class SummaryOut(BaseModel):
    matched: int
    total_spend: Decimal
    total_refunded: Decimal
    failed: int
    pending: int
    coins_earned: int
    anomalous: int


class CategorySpendOut(BaseModel):
    category_slug: str
    category_label: str
    accent_hue: int
    total: Decimal
    transactions: int


class MonthlyPointOut(BaseModel):
    month: str
    total: Decimal
    transactions: int


class CategoryFacetOut(BaseModel):
    slug: str
    label: str
    accent_hue: int
    transactions: int


class FacetsOut(BaseModel):
    categories: list[CategoryFacetOut]
    statuses: list[str]
    methods: list[str]
    amount_min: Decimal | None
    amount_max: Decimal | None
    date_min: date | None
    date_max: date | None
    total: int


# --- Rewards ----------------------------------------------------------------


class BalanceOut(BaseModel):
    balance: int
    lifetime_earned: int
    lifetime_spent: int


class RewardOut(BaseModel):
    id: int
    slug: str
    title: str
    description: str
    coin_cost: int
    rupee_value: Decimal
    stock: int | None
    affordable: bool
    coins_short: int
    in_stock: bool


class RedeemRequest(BaseModel):
    reward_id: int = Field(..., gt=0)
    # Client-generated per attempt. Makes a retry after a dropped response safe.
    idempotency_key: str = Field(..., min_length=8, max_length=64)


class RedemptionOut(BaseModel):
    id: int
    slug: str
    title: str
    coin_cost: int
    rupee_value: Decimal
    status: str
    voucher_code: str
    created_at: datetime
    balance: int
    replayed: bool


class RedemptionHistoryOut(BaseModel):
    id: int
    slug: str
    title: str
    coin_cost: int
    rupee_value: Decimal
    status: str
    voucher_code: str
    created_at: datetime
