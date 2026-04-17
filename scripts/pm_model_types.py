from __future__ import annotations

from datetime import date
from typing import Literal, NotRequired, TypedDict


class PMBankMovement(TypedDict):
    action: Literal["buy", "sell", "transfer_in", "transfer_out"]
    section: Literal["purchases", "sales", "transfers"]
    date: str
    reference: str
    securityCode: str
    isin: str | None
    nameRaw: str
    currency: str
    priceCurrency: str
    price: float | None
    units: float | None
    valueEur: float | None
    tax: NotRequired[float | None]
    taxCurrency: NotRequired[str | None]
    grossAmount: NotRequired[float | None]
    isInitialTransferIn: NotRequired[bool]


class PMBankMovementsPayload(TypedDict):
    sourcePdf: str
    generatedAt: str
    initialTransferCutoff: str
    movements: list[PMBankMovement]
    unresolved: list[PMBankMovement]


class PMTransactionDraft(TypedDict):
    action: Literal["buy", "sell"]
    date: date | None
    isin: str
    nom: str
    tipus: str
    custodian: str
    units: float | None
    nav: float | None
    valueEur: float | None
    id: NotRequired[str]


class PMTransactionRow(TypedDict):
    action: Literal["buy", "sell"]
    date: str | None
    isin: str
    nom: str
    tipus: str
    custodian: str
    units: float | None
    nav: float | None
    valueEur: float | None
    id: str


class PMMasterPosition(TypedDict):
    is_closed: bool
    tancats_year: int | None
    buy_date: date | None
    sell_date: date | None
    isin: str
    nom: str
    tipus: str
    custodian: str
    units: float
    nav: float | None
    valueEur: float | None


class PMWorkbookRow(TypedDict, total=False):
    id: str
    isin: str
    nom: str
    gestor: str | None
    custodian: str | None
    tipus: str | None
    divisa: str | None
    dataCompra: str | None
    startDate: str | None
    endDate: str | None
    unitats: float | None
    n_titols: float | None
    valorMercat: float | None
    costEur: float | None
    costInici: float | None
    rendInici: float | None
    costAnual: float | None
    bancRaw: str | None


PMClosedRow = PMWorkbookRow


class PMSnapshotPosition(TypedDict):
    isin: str
    nom: str
    custodian: str
    dataCompra: str | None
    startDate: str | None
    endDate: str | None
    unitats: float
    valorMercat: float


class PMValuePoint(TypedDict):
    date: str
    value: float | int


PMValuesByCustodian = dict[str, list[PMValuePoint]]
PMValuesByIsin = dict[str, PMValuesByCustodian]


PMClosedPosition = PMSnapshotPosition


class PMTotalMismatch(TypedDict):
    latest_date: date
    latest_total: float
    workbook_total: float
    ratio: float | None
    delta: float
