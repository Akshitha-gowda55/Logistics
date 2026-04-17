"""CO2 calculation — generic truck factor (kg CO2e per tonne-km)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Co2Model:
    kg_co2e_per_tonne_km: float = 0.062  # indicative EU average class mix
    load_tonnes: float = 18.0


def leg_emissions(distance_km: float, model: Co2Model | None = None) -> float:
    m = model or Co2Model()
    tonne_km = (m.load_tonnes * distance_km) if distance_km > 0 else 0.0
    return round(tonne_km * m.kg_co2e_per_tonne_km, 4)
