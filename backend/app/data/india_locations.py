"""India logistics reference: cities, hubs, coordinates (WGS84), and resolution helpers."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class IndiaSite:
    id: str
    map_label: str
    location_type: str  # supplier | plant | warehouse | city | hub
    lat: float
    lon: float


@dataclass(frozen=True)
class IndiaCity:
    """Canonical Indian location for routing / maps."""

    id: str
    display_name: str
    state: str
    lat: float
    lon: float
    region: str = ""
    hub_type: str = "city"  # metro | capital | tier2 | hub | warehouse
    aliases: tuple[str, ...] = ()
    show_on_map: bool = True


def _city(
    id_: str,
    name: str,
    state: str,
    lat: float,
    lon: float,
    *,
    region: str = "",
    hub_type: str = "city",
    aliases: tuple[str, ...] = (),
    show_on_map: bool = True,
) -> IndiaCity:
    return IndiaCity(
        id=id_,
        display_name=name,
        state=state,
        lat=lat,
        lon=lon,
        region=region,
        hub_type=hub_type,
        aliases=aliases,
        show_on_map=show_on_map,
    )


# State capitals, metros, tier-2 hubs, and common logistics spellings (aliases).
INDIA_CITIES: tuple[IndiaCity, ...] = (
    _city("delhi", "Delhi", "Delhi", 28.6139, 77.2090, region="North", hub_type="capital", aliases=("new delhi", "nct delhi", "dilli")),
    _city("mumbai", "Mumbai", "Maharashtra", 19.0760, 72.8777, region="West", hub_type="metro", aliases=("bombay",)),
    _city("bengaluru", "Bengaluru", "Karnataka", 12.9716, 77.5946, region="South", hub_type="metro", aliases=("bangalore", "blr")),
    _city("chennai", "Chennai", "Tamil Nadu", 13.0827, 80.2707, region="South", hub_type="metro", aliases=("madras",)),
    _city("hyderabad", "Hyderabad", "Telangana", 17.3850, 78.4867, region="South", hub_type="metro", aliases=("secunderabad",)),
    _city("kolkata", "Kolkata", "West Bengal", 22.5726, 88.3639, region="East", hub_type="metro", aliases=("calcutta",)),
    _city("pune", "Pune", "Maharashtra", 18.5204, 73.8567, region="West", hub_type="metro"),
    _city("ahmedabad", "Ahmedabad", "Gujarat", 23.0225, 72.5714, region="West", hub_type="metro"),
    _city("jaipur", "Jaipur", "Rajasthan", 26.9124, 75.7873, region="North", hub_type="capital"),
    _city("lucknow", "Lucknow", "Uttar Pradesh", 26.8467, 80.9462, region="North", hub_type="capital"),
    _city("bhopal", "Bhopal", "Madhya Pradesh", 23.2599, 77.4126, region="Central", hub_type="capital"),
    _city("patna", "Patna", "Bihar", 25.5941, 85.1376, region="East", hub_type="capital"),
    _city("ranchi", "Ranchi", "Jharkhand", 23.3441, 85.3096, region="East", hub_type="capital"),
    _city("bhubaneswar", "Bhubaneswar", "Odisha", 20.2961, 85.8245, region="East", hub_type="capital"),
    _city("chandigarh", "Chandigarh", "Chandigarh", 30.7333, 76.7794, region="North", hub_type="capital"),
    _city("kochi", "Kochi", "Kerala", 9.9312, 76.2673, region="South", hub_type="hub", aliases=("cochin", "ernakulam")),
    _city("coimbatore", "Coimbatore", "Tamil Nadu", 11.0168, 76.9558, region="South", hub_type="tier2"),
    _city("nagpur", "Nagpur", "Maharashtra", 21.1458, 79.0882, region="Central", hub_type="tier2"),
    _city("indore", "Indore", "Madhya Pradesh", 22.7196, 75.8577, region="Central", hub_type="tier2"),
    _city("mysuru", "Mysuru", "Karnataka", 12.2958, 76.6394, region="South", hub_type="tier2", aliases=("mysore",)),
    _city("hubballi", "Hubballi", "Karnataka", 15.3647, 75.1240, region="South", hub_type="tier2", aliases=("hubli",)),
    _city("vijayawada", "Vijayawada", "Andhra Pradesh", 16.5062, 80.6480, region="South", hub_type="tier2"),
    _city("visakhapatnam", "Visakhapatnam", "Andhra Pradesh", 17.6868, 83.2185, region="South", hub_type="hub", aliases=("vizag", "vishakapatnam")),
    _city("guwahati", "Guwahati", "Assam", 26.1445, 91.7362, region="NE", hub_type="hub"),
    _city("srinagar", "Srinagar", "Jammu and Kashmir", 34.0837, 74.7973, region="North", hub_type="capital"),
    _city("surat", "Surat", "Gujarat", 21.1702, 72.8311, region="West", hub_type="tier2"),
    _city("vadodara", "Vadodara", "Gujarat", 22.3072, 73.1812, region="West", hub_type="tier2", aliases=("baroda",)),
    _city("nashik", "Nashik", "Maharashtra", 19.9975, 73.7898, region="West", hub_type="tier2", aliases=("nasik",)),
    _city("kanpur", "Kanpur", "Uttar Pradesh", 26.4499, 80.3319, region="North", hub_type="tier2"),
    _city("noida", "Noida", "Uttar Pradesh", 28.5355, 77.3910, region="North", hub_type="hub"),
    _city("gurugram", "Gurugram", "Haryana", 28.4595, 77.0266, region="North", hub_type="hub", aliases=("gurgaon",)),
    _city("thiruvananthapuram", "Thiruvananthapuram", "Kerala", 8.5241, 76.9366, region="South", hub_type="capital", aliases=("trivandrum",)),
    _city("dehradun", "Dehradun", "Uttarakhand", 30.3165, 78.0322, region="North", hub_type="capital"),
    _city("shimla", "Shimla", "Himachal Pradesh", 31.1048, 77.1734, region="North", hub_type="capital"),
    _city("gandhinagar", "Gandhinagar", "Gujarat", 23.2156, 72.6369, region="West", hub_type="capital"),
    _city("raipur", "Raipur", "Chhattisgarh", 21.2514, 81.6296, region="Central", hub_type="capital"),
    _city("panaji", "Panaji", "Goa", 15.4909, 73.8278, region="West", hub_type="capital", aliases=("panjim",)),
    _city("imphal", "Imphal", "Manipur", 24.8170, 93.9368, region="NE", hub_type="capital"),
    _city("aizawl", "Aizawl", "Mizoram", 23.7271, 92.7176, region="NE", hub_type="capital"),
    _city("kohima", "Kohima", "Nagaland", 25.6747, 94.1100, region="NE", hub_type="capital"),
    _city("shillong", "Shillong", "Meghalaya", 25.5788, 91.8933, region="NE", hub_type="capital"),
    _city("itanagar", "Itanagar", "Arunachal Pradesh", 27.0844, 93.6059, region="NE", hub_type="capital"),
    _city("gangtok", "Gangtok", "Sikkim", 27.3389, 88.6065, region="NE", hub_type="capital"),
    _city("agartala", "Agartala", "Tripura", 23.8315, 91.2868, region="NE", hub_type="capital"),
    _city("dispur", "Dispur", "Assam", 26.1433, 91.7898, region="NE", hub_type="capital"),
    _city("jammu", "Jammu", "Jammu and Kashmir", 32.7266, 74.8570, region="North", hub_type="tier2"),
    _city("amritsar", "Amritsar", "Punjab", 31.6340, 74.8723, region="North", hub_type="tier2"),
    _city("ludhiana", "Ludhiana", "Punjab", 30.9010, 75.8573, region="North", hub_type="tier2"),
    _city("varanasi", "Varanasi", "Uttar Pradesh", 25.3176, 82.9739, region="North", hub_type="tier2", aliases=("benares",)),
    _city("agra", "Agra", "Uttar Pradesh", 27.1767, 78.0081, region="North", hub_type="tier2"),
    _city("meerut", "Meerut", "Uttar Pradesh", 28.9845, 77.7064, region="North", hub_type="tier2"),
    _city("jodhpur", "Jodhpur", "Rajasthan", 26.2389, 73.0243, region="North", hub_type="tier2"),
    _city("udaipur", "Udaipur", "Rajasthan", 24.5854, 73.7125, region="North", hub_type="tier2"),
    _city("rajkot", "Rajkot", "Gujarat", 22.3039, 70.8022, region="West", hub_type="tier2"),
    _city("jabalpur", "Jabalpur", "Madhya Pradesh", 23.1815, 79.9864, region="Central", hub_type="tier2"),
    _city("gwalior", "Gwalior", "Madhya Pradesh", 26.2183, 78.1828, region="Central", hub_type="tier2"),
    _city("salem", "Salem", "Tamil Nadu", 11.6643, 78.1460, region="South", hub_type="tier2"),
    _city("madurai", "Madurai", "Tamil Nadu", 9.9252, 78.1198, region="South", hub_type="tier2"),
    _city("tiruchirappalli", "Tiruchirappalli", "Tamil Nadu", 10.7905, 78.7047, region="South", hub_type="tier2", aliases=("trichy", "tiruchy")),
    _city("mangaluru", "Mangaluru", "Karnataka", 12.9141, 74.8560, region="South", hub_type="tier2", aliases=("mangalore",)),
    _city("belagavi", "Belagavi", "Karnataka", 15.8497, 74.4977, region="South", hub_type="tier2", aliases=("belgaum",)),
    _city("goa_margao", "Margao", "Goa", 15.2736, 73.9583, region="West", hub_type="tier2"),
    _city("siliguri", "Siliguri", "West Bengal", 26.7271, 88.3953, region="East", hub_type="hub"),
    _city("durgapur", "Durgapur", "West Bengal", 23.5204, 87.3119, region="East", hub_type="tier2"),
    _city("asansol", "Asansol", "West Bengal", 23.6739, 86.9524, region="East", hub_type="tier2"),
)

_INDIA_CITY_BY_ID: dict[str, IndiaCity] = {c.id: c for c in INDIA_CITIES}
_ALL_NAMES: list[tuple[str, IndiaCity]] = []
for c in INDIA_CITIES:
    _ALL_NAMES.append((c.display_name.lower(), c))
    _ALL_NAMES.append((c.id.lower(), c))
    for a in c.aliases:
        _ALL_NAMES.append((a.lower(), c))


def _strip_logistics_suffixes(q: str) -> str:
    s = q.strip().lower()
    s = re.sub(r"\s*wh[- ]?\d*", "", s)
    s = re.sub(r"\s*dc\d*", "", s)
    s = re.sub(r"\s*hub\b", "", s)
    s = re.sub(r"\s*mega\s*", " ", s)
    s = re.sub(r"\s*warehouse\b", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_location_query(raw: str) -> str:
    return _strip_logistics_suffixes(raw)


def resolve_india_city(user_input: str) -> IndiaCity | None:
    """Resolve free text (city, 'Mumbai DC', alias) to a canonical IndiaCity."""
    if not user_input or not user_input.strip():
        return None
    q = normalize_location_query(user_input)
    if not q:
        return None
    # Exact id
    if q in _INDIA_CITY_BY_ID:
        return _INDIA_CITY_BY_ID[q]
    # Exact display / alias
    for name, city in _ALL_NAMES:
        if q == name:
            return city
    # First token match (e.g. "mumbai" from "mumbai something")
    first = q.split()[0]
    if first in _INDIA_CITY_BY_ID:
        return _INDIA_CITY_BY_ID[first]
    for name, city in _ALL_NAMES:
        if first == name:
            return city
    # Substring: prefer longest matching name
    best: tuple[int, IndiaCity] | None = None
    for name, city in _ALL_NAMES:
        if name in q or q in name:
            score = len(name)
            if best is None or score > best[0]:
                best = (score, city)
    if best:
        return best[1]
    return None


def india_cities_reference() -> list[dict[str, str | float]]:
    """Wire DTO for GET /reference/india-cities."""
    out: list[dict[str, str | float]] = []
    for c in INDIA_CITIES:
        out.append(
            {
                "id": c.id,
                "display_name": c.display_name,
                "state": c.state,
                "latitude": c.lat,
                "longitude": c.lon,
                "region": c.region,
                "hub_type": c.hub_type,
            }
        )
    return out


# Legacy supplier/plant/warehouse pins (demo network).
INDIA_SUPPLIERS: tuple[IndiaSite, ...] = (
    IndiaSite("sup_chennai", "Chennai Supplier", "supplier", 13.0827, 80.2707),
    IndiaSite("sup_pune", "Pune Supplier", "supplier", 18.5204, 73.8567),
    IndiaSite("sup_gurugram", "Gurugram Supplier", "supplier", 28.4595, 77.0266),
    IndiaSite("sup_sanand", "Sanand Supplier", "supplier", 22.9947, 72.3826),
    IndiaSite("sup_hosur", "Hosur Supplier", "supplier", 12.7409, 77.8253),
)

INDIA_PLANTS: tuple[IndiaSite, ...] = (
    IndiaSite("plant_blr", "Bengaluru Plant", "plant", 12.9716, 77.5946),
    IndiaSite("plant_chennai", "Chennai Plant", "plant", 13.0827, 80.2707),
    IndiaSite("plant_pune", "Pune Plant", "plant", 18.5204, 73.8567),
    IndiaSite("plant_hyd", "Hyderabad Plant", "plant", 17.3850, 78.4867),
    IndiaSite("plant_amd", "Ahmedabad Plant", "plant", 23.0225, 72.5714),
)

INDIA_WAREHOUSES: tuple[IndiaSite, ...] = (
    IndiaSite("wh_mumbai", "Mumbai Warehouse", "warehouse", 19.0760, 72.8777),
    IndiaSite("wh_delhi", "Delhi Warehouse", "warehouse", 28.6139, 77.2090),
    IndiaSite("wh_blr", "Bengaluru Warehouse", "warehouse", 12.9716, 77.5946),
    IndiaSite("wh_kolkata", "Kolkata Warehouse", "warehouse", 22.5726, 88.3639),
)


def all_india_sites() -> list[IndiaSite]:
    sites: list[IndiaSite] = list(INDIA_SUPPLIERS) + list(INDIA_PLANTS) + list(INDIA_WAREHOUSES)
    seen: set[str] = {s.id for s in sites}
    for c in INDIA_CITIES:
        if not c.show_on_map:
            continue
        key = f"city_{c.id}"
        if key in seen:
            continue
        seen.add(key)
        sites.append(IndiaSite(key, c.display_name, c.hub_type, c.lat, c.lon))
    return sites


def default_demo_corridor_cities() -> tuple[IndiaCity, IndiaCity]:
    """When no OD is provided, use a representative India pair (not a single fixed truck leg)."""
    o = _INDIA_CITY_BY_ID["mumbai"]
    d = _INDIA_CITY_BY_ID["delhi"]
    return o, d
