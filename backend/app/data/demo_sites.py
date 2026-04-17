"""India demo network for routing / optimization (see app.data.india_locations)."""

from optimization_engine.routing.optimizer import Site

from app.data.india_locations import INDIA_PLANTS, INDIA_SUPPLIERS, INDIA_WAREHOUSES

DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

# Bengaluru plant + key nodes for greedy route demo
DEMO_SITES: list[Site] = [
    Site(INDIA_PLANTS[0].id, INDIA_PLANTS[0].map_label, INDIA_PLANTS[0].lat, INDIA_PLANTS[0].lon),
    Site(INDIA_WAREHOUSES[0].id, INDIA_WAREHOUSES[0].map_label, INDIA_WAREHOUSES[0].lat, INDIA_WAREHOUSES[0].lon),
    Site(INDIA_SUPPLIERS[0].id, INDIA_SUPPLIERS[0].map_label, INDIA_SUPPLIERS[0].lat, INDIA_SUPPLIERS[0].lon),
    Site(INDIA_SUPPLIERS[1].id, INDIA_SUPPLIERS[1].map_label, INDIA_SUPPLIERS[1].lat, INDIA_SUPPLIERS[1].lon),
]

PLANT = DEMO_SITES[0]
