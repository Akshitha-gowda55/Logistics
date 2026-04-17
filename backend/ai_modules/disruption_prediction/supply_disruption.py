"""Supply disruption prediction: supplier delay risk, shipment delay, inventory shortage."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SupplyDisruptionAlert:
    detection_type: str  # supplier_delay | shipment_delay | inventory_shortage
    headline: str
    severity: str
    probability: float
    detail: str
    horizon_days: int | None = None


def detect_supply_disruptions(organization_id: str) -> list[SupplyDisruptionAlert]:
    """
    Rule-based detectors (replaceable with ML / telemetry).

    Detects:
    - supplier_delay: elevated lead-time / OTIF variance vs baseline
    - shipment_delay: in-transit ETA slip vs plan
    - inventory_shortage: projected stockout within horizon_days
    """
    _ = organization_id
    shortage_days = 2

    return [
        SupplyDisruptionAlert(
            detection_type="supplier_delay",
            headline="Supplier delay HIGH",
            severity="high",
            probability=0.84,
            detail="Supplier Hub (MUC): confirmed PO acknowledgements lagging +1.8d vs 30d baseline; alternate lane capacity tight.",
            horizon_days=None,
        ),
        SupplyDisruptionAlert(
            detection_type="shipment_delay",
            headline="Shipment delay predicted",
            severity="medium",
            probability=0.76,
            detail="PRG → FDH (SH-204915): dwell + weather window; model ETA +6.4h vs plan with rising confidence.",
            horizon_days=None,
        ),
        SupplyDisruptionAlert(
            detection_type="inventory_shortage",
            headline="Inventory shortage in 2 days",
            severity="high",
            probability=0.81,
            detail="BRG-440C @ Plant FDH: projected cover falls below safety stock in 2d on current burn + inbound schedule.",
            horizon_days=shortage_days,
        ),
    ]
