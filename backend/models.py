from typing import Literal
from pydantic import BaseModel


class Waypoint(BaseModel):
    lat: float
    lon: float
    t: int  # epoch seconds


class Flight(BaseModel):
    id: str
    icao24: str
    track: list[Waypoint] = []
    affected: bool = False
    is_hero: bool = False
    arr: str | None = None
    first_seen: int | None = None
    last_seen: int | None = None


class CostBreakdown(BaseModel):
    total_usd: float
    delay_usd: float
    fuel_usd: float
    crew_usd: float
    detail: str


class ActionOption(BaseModel):
    kind: Literal["hold", "divert", "preempt"]
    cost_usd: float
    cheapest: bool
    rationale: str


class Event(BaseModel):
    id: str
    name: str
    summary: str
    polygon: list[list[float]]
    affected_flight_ids: list[str]
    cost: CostBreakdown
    options: list[ActionOption]
    bookmarked: bool = True


class NetworkView(BaseModel):
    selfish_usd: float
    coordinated_usd: float
    gap_usd: float


class NewsItem(BaseModel):
    id: str
    headline: str
    summary: str
    source: str
    can_bookmark: bool = True


class MetarMarker(BaseModel):
    station: str
    lat: float
    lon: float
    flight_category: str
    raw: str


class StateModel(BaseModel):
    events: list[Event]
    flights: list[Flight]
    sectors: dict
    weather: list[MetarMarker]
    news: list[NewsItem]
    network: NetworkView
