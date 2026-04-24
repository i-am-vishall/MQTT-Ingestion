# Goa Smart City ICCC V6 - Crowd Prediction Architecture

This document strictly defines the data variables, schema, and architectural hierarchy used to power the Goa Operations Dashboard. Everything that goes unused by the dashboard has been aggressively stripped out to ensure a lean, operation-centric intelligence system.

---

## 🏗 Architecture Hierarchy & Flow

Data flows through three explicit architectural layers:

### 1. The Ingestion Layer (Raw Metrics)
Real-time streaming inputs generated externally (or by the simulator) and accepted via FastAPI endpoints (`/api/v1/booking/inflow`).
- **`booking_inflow` table**: Granular record of every single transport booking (Flight, Train, Bus).
- **`daily_metrics` table**: External environmental data (Hotel Occupancy, Rain Probability).

### 2. The Predictive Modeling Engine (`engine.py`)
Triggered sequentially upon new ingestion. 
1. Calculates True Active Crowd dynamically using a lagging 4-day departure window against rolling arrivals.
2. Identifies capacity constraints recursively across domains.
3. Overwrites aggregated insights into the SQL Layer.
- **`daily_estimation` table**: Overwrites historical/live metrics dynamically.
- **`projection_curve` table**: Continuously mathematical projection out to Mar 18.
- **`zone_distribution` table**: Triggers physical limits logic and spills over into adjacent zones.

### 3. The ICCC Intelligence Views (PostgreSQL SQL Views)
Grafana queries these logic blocks directly. The Views intercept raw `daily_estimation` and `zone_distribution` values, applying situational intelligence formats (e.g. converting raw Panaji crowd metrics into Time-of-day blocks and triggering Spillover thresholds).

---

## 🗄️ Database Tables (Core Storage)

Only EXACTLY what is needed for calculations and Grafana views is stored.

### `booking_inflow`
Stores specific transport tickets arriving in Goa.
- `id`: Primary key
- `booking_date`: When the booking was placed
- `target_date`: When the person actually arrives in Goa
- `mode`: Type of transit (`flight`, `train`, `bus`)
- `origin_city`: E.g., `Mumbai`, `Delhi`
- `arrival_count`: Number of passengers

### `daily_metrics`
Stores environmental contexts affecting constraints.
- `date`: System date
- `hotel_occupancy`: Floating percent (0.50 - 0.98)
- `rain_probability`: Float (0.0 to 1.0) altering outdoor behaviors

### `zone_distribution`
Stores Engine's hard-limited congestion models.
- `date`
- `zone`: Baga, Panaji, Calangute, etc.
- `predicted_crowd`: Bounded safely by dynamic local limits.

### `daily_estimation`
Core Math for active situation awareness.
- `date`
- `daily_arrivals`
- `daily_departures`: Exact lag of arrivals 4 days prior
- `active_crowd`: Mathematically tracked active people
- `confidence_score`: Base 85% reduced dynamically by excessive >250k traffic or volatility.

### `projection_curve`
Pure mathematical trailing of expected Active load for next 15 days.
- `projection_date`
- `projected_crowd`

---

## 👁️ Active SQL Views (Grafana Interceptors)

These views bridge raw storage into the visualization interface:

1. **`iccc_v6_row1_snapshot`**:
   - Calculates **rolling active crowd**, strictly constraining logic to (3 days historical arrivals) - (today's expected departures).
   - Generates the explicit Yesterday vs Today Arrival Growth `%`.
   - Drives Row 1 completely.

2. **`iccc_v5_origin_intelligence`**:
   - Compiles **next 3 days flow** from `booking_inflow`.
   - Projects 🔴 High/Med/Low intelligence risk based on sudden route influxes.
   - Converts cities mathematically into States tracking origin depth.

3. **`iccc_v5_time_of_day_distribution`**:
   - Re-allocates daily Panaji/Baga static crowds into **dynamic hour blocks** (08:00, 11:00, 14:00, 18:00, 22:00) using heavy weekend/rain scaling equations inside PostgreSQL.

4. **`iccc_v5_operational_alerts`**:
   - Checks constraints live. Trips **Airport Peak Alerts** if >7,000 flights hit within 24hr growth cycles.
   - Trips **Spillover Triggers** if Beach limits strictly break structural ceilings.
