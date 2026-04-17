-- Logistics AI platform — core PostgreSQL schema
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations & sites
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    site_type VARCHAR(64) NOT NULL CHECK (site_type IN ('plant', 'warehouse', 'supplier', 'customer', 'hub')),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sites_org ON sites(organization_id);

-- Inventory
CREATE TABLE sku (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sku_code VARCHAR(128) NOT NULL,
    description TEXT,
    unit VARCHAR(32) NOT NULL DEFAULT 'ea',
    UNIQUE (organization_id, sku_code)
);

CREATE TABLE inventory_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku_id UUID NOT NULL REFERENCES sku(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
    safety_stock NUMERIC(18, 4) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sku_id, site_id)
);

-- Demand & forecasting artifacts
CREATE TABLE demand_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku_id UUID NOT NULL REFERENCES sku(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    period_start DATE NOT NULL,
    quantity NUMERIC(18, 4) NOT NULL,
    UNIQUE (sku_id, site_id, period_start)
);

CREATE TABLE demand_forecasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku_id UUID NOT NULL REFERENCES sku(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    forecast_horizon_days INT NOT NULL,
    model_version VARCHAR(64) NOT NULL,
    predicted_quantity NUMERIC(18, 4) NOT NULL,
    confidence_low NUMERIC(18, 4),
    confidence_high NUMERIC(18, 4),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forecasts_sku_time ON demand_forecasts(sku_id, generated_at DESC);

-- Disruptions
CREATE TABLE disruption_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    severity VARCHAR(32) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    category VARCHAR(64) NOT NULL,
    affected_site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    probability NUMERIC(5, 4) NOT NULL CHECK (probability >= 0 AND probability <= 1),
    estimated_impact_cost NUMERIC(18, 2),
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_disruptions_org ON disruption_events(organization_id, detected_at DESC);

-- Fleet & shipments
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    identifier VARCHAR(64) NOT NULL,
    capacity_kg NUMERIC(18, 4),
    co2_g_per_km NUMERIC(18, 6),
    UNIQUE (organization_id, identifier)
);

CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    origin_site_id UUID NOT NULL REFERENCES sites(id),
    destination_site_id UUID NOT NULL REFERENCES sites(id),
    status VARCHAR(32) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_transit', 'delivered', 'cancelled')),
    planned_departure TIMESTAMPTZ,
    planned_arrival TIMESTAMPTZ,
    weight_kg NUMERIC(18, 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimized routes
CREATE TABLE optimized_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    name VARCHAR(255),
    total_distance_km NUMERIC(18, 4),
    total_duration_minutes INT,
    total_cost NUMERIC(18, 2),
    total_co2_kg NUMERIC(18, 6),
    waypoints JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_routes_org ON optimized_routes(organization_id, created_at DESC);

-- Optimization run audit
CREATE TABLE optimization_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    run_type VARCHAR(64) NOT NULL,
    input_snapshot JSONB,
    output_summary JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'completed',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

-- Seed demo org (optional for local dev)
INSERT INTO organizations (id, name) VALUES
    ('00000000-0000-0000-0000-000000000001', 'India Logistics Network');

INSERT INTO sites (organization_id, name, site_type, latitude, longitude, address) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Bengaluru Plant', 'plant', 12.9716, 77.5946, 'Bengaluru, IN'),
    ('00000000-0000-0000-0000-000000000001', 'Mumbai Warehouse', 'warehouse', 19.0760, 72.8777, 'Mumbai, IN'),
    ('00000000-0000-0000-0000-000000000001', 'Chennai Supplier', 'supplier', 13.0827, 80.2707, 'Chennai, IN'),
    ('00000000-0000-0000-0000-000000000001', 'Pune Supplier', 'supplier', 18.5204, 73.8567, 'Pune, IN');
