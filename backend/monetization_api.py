"""Router monetisasi (Fase 2): paket, saldo/dompet, kartu langganan."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field


class TopupInput(BaseModel):
    amount: int = Field(..., ge=10000)
    method: str = "transfer"


class PurchaseInput(BaseModel):
    months: int = Field(..., ge=1, le=24)
    method: str = "wallet"


class AutoRenewInput(BaseModel):
    enabled: bool


class AttachInput(BaseModel):
    siteId: str


def build_router(m, current_user):
    r = APIRouter(tags=["monetisasi"])

    @r.get("/packages")
    async def packages():
        return await m.packages_public()

    @r.get("/quota-info")
    async def quota_info(user=Depends(current_user)):
        """Info kuota model kartu (dipakai halaman bikin website + dashboard)."""
        return await m.quota_info(user)

    @r.get("/wallet")
    async def wallet(user=Depends(current_user)):
        return await m.wallet_view(user)

    @r.post("/wallet/topup")
    async def topup(data: TopupInput, user=Depends(current_user)):
        return await m.request_topup(user, data.amount, data.method)

    @r.get("/cards")
    async def cards(user=Depends(current_user)):
        return await m.cards_view(user)

    @r.post("/cards")
    async def card_create(data: PurchaseInput, user=Depends(current_user)):
        return await m.create_card(user, data.months, data.method)

    @r.get("/cards/{card_id}")
    async def card_detail(card_id: str, user=Depends(current_user)):
        return await m.card_detail(user, card_id)

    @r.post("/cards/{card_id}/purchase")
    async def card_purchase(card_id: str, data: PurchaseInput, user=Depends(current_user)):
        return await m.purchase(user, card_id, data.months, data.method)

    @r.patch("/cards/{card_id}/autorenew")
    async def card_autorenew(card_id: str, data: AutoRenewInput, user=Depends(current_user)):
        return await m.set_autorenew(user, card_id, data.enabled)

    @r.post("/cards/{card_id}/attach")
    async def card_attach(card_id: str, data: AttachInput, user=Depends(current_user)):
        return await m.attach(user, card_id, data.siteId)

    @r.post("/cards/{card_id}/detach")
    async def card_detach(card_id: str, user=Depends(current_user)):
        return await m.detach(user, card_id)

    return r