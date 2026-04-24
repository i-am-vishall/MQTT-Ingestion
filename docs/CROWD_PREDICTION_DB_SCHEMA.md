# 🇮🇳 Goa Crowd Prediction Engine - Database Schema

This document outlines the complete PostgreSQL database structure running the 10-Point Advanced Crowd Prediction Model for the March 2026 Shigmo and Holi Festivals.

---

## 1. Raw Data Ingestion

### `booking_inflow`
Stores every individual simulated (or real) booking payload. This is the foundation of the origin-based and lead-time logic.

```sql
CREATE TABLE booking_inflow (
    id SERIAL PRIMARY KEY,
    booking_date DATE NOT NULL,      -- The date the booking was made
    target_date DATE NOT NULL,       -- The date the tourist will arrive in Goa
    mode TEXT NOT NULL,              -- flight, train, bus
    origin_city TEXT NOT NULL,       -- Mumbai, Delhi, Bangalore, etc.
    arrival_count INT DEFAULT 0,     -- Number of people arriving
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `daily_metrics`
Stores daily environmental and social factors that constrain or boost crowd sizes.

```sql
CREATE TABLE daily_metrics (
    date DATE UNIQUE NOT NULL,
    hotel_occupancy FLOAT DEFAULT 0.0,    -- 0.0 to 1.0 (Caps at 0.95 heavily penalizes growth)
    weather_condition TEXT,
    rain_probability FLOAT DEFAULT 0.0,   -- > 0.6 shifts crowds away from beaches
    social_buzz_index FLOAT DEFAULT 1.0,  -- Multiplier representing internet hype
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. Core Intelligence Models

### `daily_estimation`
The master intelligence table containing the calculated live state of Goa for any given day. Combines arrivals, stay duration, weather, and events.

```sql
CREATE TABLE daily_estimation (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    daily_arrivals INT DEFAULT 0,         -- Total incoming tourists today
    daily_departures INT DEFAULT 0,       -- Tourists leaving (Calculated via 4-day stay model)
    active_crowd INT DEFAULT 0,           -- Total tourists currently in Goa
    event_multiplier FLOAT DEFAULT 1.0,   -- Logistic curve multiplier based on nearest festival
    weather_multiplier FLOAT DEFAULT 1.0, 
    estimated_crowd INT DEFAULT 0,        -- Final normalized crowd count
    velocity_percent FLOAT DEFAULT 0.0,   -- MoM growth rate
    risk_level TEXT,                      -- LOW, MEDIUM, HIGH, CRITICAL
    confidence_score FLOAT DEFAULT 100.0, -- AI Confidence in prediction (drops on volatility)
    is_anomaly BOOLEAN DEFAULT FALSE,     -- True if arrivals > 2 Standard Deviations from mean
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `projection_curve`
Stores the forward-looking AI projection calculated off the historical baseline, stretching until the end of the festival period (March 18, 2026).

```sql
CREATE TABLE projection_curve (
    id SERIAL PRIMARY KEY,
    projection_date DATE NOT NULL UNIQUE,
    projected_crowd INT DEFAULT 0,        -- AI guessed crowd size
    confidence_score FLOAT DEFAULT 100.0, -- Drops lower the further into the future it guesses
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Zone & Origin Tracking

### `zone_distribution`
Distributes the `estimated_crowd` across Goa's specific geographic zones dynamically factoring in festival events and weather constraints.

```sql
CREATE TABLE zone_distribution (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    zone TEXT NOT NULL,                   -- Baga, Calangute, Vagator, Anjuna, Panaji, Others
    predicted_crowd INT DEFAULT 0,        -- Number of people in this zone
    risk_level TEXT,                      -- Congestion warning if numbers exceed soft limits (e.g., 45k)
    growth_percent FLOAT DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, zone)
);
```

### `origin_breakdown`
Aggregated table summarizing feeder cities and states specifically structured for rendering Grafana Pie Charts and mode-share graphs instantly.

```sql
CREATE TABLE origin_breakdown (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    origin_city TEXT NOT NULL,
    state TEXT NOT NULL,
    mode TEXT NOT NULL,
    arrivals INT DEFAULT 0,
    UNIQUE(date, origin_city, mode)
);
```

---

## 4. Static Definitions

### `event_calendar`
Anchors the logistic intensity curve math. Holds the peak dates for major events.

```sql
CREATE TABLE event_calendar (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,            -- The exact peak date of the event
    event_name TEXT NOT NULL,
    base_intensity FLOAT NOT NULL         -- Maximum theoretical multiplier
);

-- Active Seed Data:
-- ('2026-03-08', 'Shigmo', 1.4)
-- ('2026-03-14', 'Holi', 1.6)
-- ('2026-03-18', 'Shigmo End', 1.0)
```
