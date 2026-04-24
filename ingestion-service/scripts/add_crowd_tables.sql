-- 🏗️ Goa Smart City ICCC V6 - Operation Centric Schema
-- STRICTLY limited to exactly what is actively queried by the command center.

DROP TABLE IF EXISTS booking_inflow CASCADE;
DROP TABLE IF EXISTS daily_estimation CASCADE;
DROP TABLE IF EXISTS zone_distribution CASCADE;
DROP TABLE IF EXISTS event_calendar CASCADE;
DROP TABLE IF EXISTS daily_metrics CASCADE;
DROP TABLE IF EXISTS projection_curve CASCADE;
DROP TABLE IF EXISTS zone_capacity CASCADE;
DROP TABLE IF EXISTS mode_capacity CASCADE;

-- 1️⃣ booking_inflow (Origin & Forward Lead-Time tracking)
CREATE TABLE booking_inflow (
    id SERIAL PRIMARY KEY,
    booking_date DATE NOT NULL,
    target_date DATE NOT NULL,
    mode TEXT NOT NULL,
    origin_city TEXT NOT NULL,
    arrival_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2️⃣ daily_metrics (Hotels & Weather tracking)
CREATE TABLE daily_metrics (
    date DATE UNIQUE NOT NULL,
    hotel_occupancy FLOAT DEFAULT 0.0,
    rain_probability FLOAT DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3️⃣ daily_estimation (Core Analytics & Return Flow Math)
CREATE TABLE daily_estimation (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    daily_arrivals INT DEFAULT 0,
    daily_departures INT DEFAULT 0,
    active_crowd INT DEFAULT 0,
    confidence_score FLOAT DEFAULT 100.0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4️⃣ projection_curve (Continuous math curve for next 15 days)
CREATE TABLE projection_curve (
    id SERIAL PRIMARY KEY,
    projection_date DATE NOT NULL,
    projected_crowd INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(projection_date)
);

-- 5️⃣ zone_distribution (Active congestion modeling)
CREATE TABLE zone_distribution (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    zone TEXT NOT NULL,
    predicted_crowd INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, zone)
);

-- 6️⃣ event_calendar (Base definitions for engine curve logic)
CREATE TABLE event_calendar (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    event_name TEXT NOT NULL,
    base_intensity FLOAT NOT NULL
);

-- Insert Goa March anchors (Curve generates preceding days)
INSERT INTO event_calendar (date, event_name, base_intensity) VALUES
('2026-03-08', 'Shigmo', 1.4),
('2026-03-14', 'Holi', 1.6),
('2026-03-18', 'Shigmo End', 1.0)
ON CONFLICT (date) DO NOTHING;

-- 7️⃣ zone_capacity (Hard limitations)
CREATE TABLE zone_capacity (
    id SERIAL PRIMARY KEY,
    zone TEXT UNIQUE NOT NULL,
    hard_limit INT NOT NULL,
    soft_limit INT NOT NULL
);

INSERT INTO zone_capacity (zone, hard_limit, soft_limit) VALUES
('Baga', 45000, 30000),
('Calangute', 45000, 30000),
('Panaji', 55000, 40000),
('Vagator', 35000, 25000),
('Anjuna', 35000, 25000),
('Others', 85000, 60000)
ON CONFLICT (zone) DO NOTHING;

-- 8️⃣ mode_capacity (Transit throughput limits)
CREATE TABLE mode_capacity (
    id SERIAL PRIMARY KEY,
    mode TEXT UNIQUE NOT NULL,
    max_daily_intake INT NOT NULL
);

INSERT INTO mode_capacity (mode, max_daily_intake) VALUES
('flight', 15000),
('train', 25000),
('bus', 15000)
ON CONFLICT (mode) DO NOTHING;
