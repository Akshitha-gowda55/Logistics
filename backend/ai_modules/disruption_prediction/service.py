"""Disruption prediction — network risks + supply disruption alerts."""

from __future__ import annotations

from dataclasses import dataclass

from ai_modules.disruption_prediction.supply_disruption import (
    SupplyDisruptionAlert,
    detect_supply_disruptions,
)


@dataclass(frozen=True)
class DisruptionRisk:
    title: str
    category: str
    severity: str
    probability: float
    affected_site: str | None


class DisruptionPredictionService:
    def predict(self, organization_id: str) -> list[DisruptionRisk]:
        _ = organization_id
        return [
            DisruptionRisk(
                title="Weather window — elevated delay risk on north corridor",
                category="weather",
                severity="medium",
                probability=0.42,
                affected_site="Regional DC North",
            ),
            DisruptionRisk(
                title="Supplier lead-time variance vs 30d baseline",
                category="supplier",
                severity="low",
                probability=0.28,
                affected_site="Supplier Hub",
            ),
            DisruptionRisk(
                title="Port congestion index spike (regional)",
                category="network",
                severity="high",
                probability=0.61,
                affected_site=None,
            ),
        ]

    def supply_alerts(self, organization_id: str) -> list[SupplyDisruptionAlert]:
        return detect_supply_disruptions(organization_id)
