"""Inventory optimization — service levels and replenishment suggestions."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class InventoryRecommendation:
    sku_code: str
    site_name: str
    current_qty: float
    target_qty: float
    rationale: str


class InventoryOptimizationService:
    def recommend(self) -> list[InventoryRecommendation]:
        return [
            InventoryRecommendation(
                sku_code="BRG-440C",
                site_name="Plant Friedrichshafen",
                current_qty=820.0,
                target_qty=1100.0,
                rationale="Raise safety stock ahead of forecasted demand peak; service target 98%.",
            ),
            InventoryRecommendation(
                sku_code="GEA-9HP",
                site_name="Regional DC North",
                current_qty=2400.0,
                target_qty=2100.0,
                rationale="Slow mover; reduce holding cost while keeping cover > 21 days.",
            ),
        ]
