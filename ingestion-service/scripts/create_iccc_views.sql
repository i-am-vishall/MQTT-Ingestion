-- 🏗️ Smart City ICCC - Decision Intelligence Views
-- Layer 3: Intelligence Layer (Dashboard only queries these)

DROP VIEW IF EXISTS iccc_executive_status CASCADE;
DROP VIEW IF EXISTS iccc_forecast_timeline CASCADE;
DROP VIEW IF EXISTS iccc_risk_forecast CASCADE;
DROP VIEW IF EXISTS iccc_state_contribution CASCADE;
DROP VIEW IF EXISTS iccc_mode_pressure CASCADE;
DROP VIEW IF EXISTS iccc_lead_time_visibility CASCADE;
DROP VIEW IF EXISTS iccc_zone_matrix CASCADE;
DROP VIEW IF EXISTS iccc_ops_constraints CASCADE;
DROP VIEW IF EXISTS iccc_return_flow CASCADE;

-- 1️⃣ EXECUTIVE COMMAND VIEW
CREATE OR REPLACE VIEW iccc_executive_status AS
WITH current_metrics AS (
    SELECT active_crowd, risk_level, confidence_score
    FROM daily_estimation
    ORDER BY date DESC LIMIT 1
),
peak_metrics AS (
    SELECT projection_date, projected_crowd
    FROM projection_curve
    ORDER BY projected_crowd DESC LIMIT 1
)
SELECT 
    c.active_crowd,
    p.projected_crowd AS forecast_peak,
    GREATEST((p.projection_date - CURRENT_DATE), 0) AS days_to_peak,
    c.risk_level,
    c.confidence_score
FROM current_metrics c, peak_metrics p;

-- 2️⃣ CROWD EVOLUTION TIMELINE
CREATE OR REPLACE VIEW iccc_forecast_timeline AS
SELECT 
    date AS time, 
    estimated_crowd AS actual_crowd,
    NULL::INT AS forecast_crowd
FROM daily_estimation
UNION ALL
SELECT 
    projection_date AS time,
    NULL::INT AS actual_crowd,
    projected_crowd AS forecast_crowd
FROM projection_curve
ORDER BY time ASC;

-- 3️⃣ RISK FORECAST PANEL (Next 7 Days)
CREATE OR REPLACE VIEW iccc_risk_forecast AS
SELECT 
    projection_date AS date,
    projected_crowd,
    CASE 
        WHEN projected_crowd > 180000 THEN 'CRITICAL'
        WHEN projected_crowd > 120000 THEN 'HIGH'
        WHEN projected_crowd > 80000 THEN 'MEDIUM'
        ELSE 'LOW'
    END AS risk_level,
    ROUND((projected_crowd::numeric / 200000.0) * 100, 1) AS capacity_percent
FROM projection_curve
WHERE projection_date >= CURRENT_DATE
ORDER BY projection_date ASC
LIMIT 7;

-- 4️⃣ STATE CONTRIBUTION (With 3-day growth & Mode Dominance)
CREATE OR REPLACE VIEW iccc_state_contribution AS
WITH latest_date AS (
    SELECT MAX(date) as max_d FROM origin_breakdown
),
current_state_totals AS (
    SELECT state, SUM(arrivals) as total_arr
    FROM origin_breakdown 
    WHERE date = (SELECT max_d FROM latest_date)
    GROUP BY state
),
total_daily AS (
    SELECT SUM(total_arr) as grand_total FROM current_state_totals
),
past_state_totals AS (
    SELECT state, SUM(arrivals) as past_arr
    FROM origin_breakdown 
    WHERE date = (SELECT max_d - interval '3 days' FROM latest_date)
    GROUP BY state
),
mode_totals AS (
    SELECT state, mode, SUM(arrivals) as mode_arr,
           ROW_NUMBER() OVER(PARTITION BY state ORDER BY SUM(arrivals) DESC) as rn
    FROM origin_breakdown
    WHERE date = (SELECT max_d FROM latest_date)
    GROUP BY state, mode
)
SELECT 
    c.state,
    ROUND((c.total_arr::numeric / t.grand_total) * 100, 1) AS share_percent,
    ROUND(((c.total_arr - p.past_arr)::numeric / NULLIF(p.past_arr, 0)) * 100, 1) AS growth_3d,
    m.mode AS dominant_mode
FROM current_state_totals c
CROSS JOIN total_daily t
LEFT JOIN past_state_totals p ON c.state = p.state
LEFT JOIN mode_totals m ON c.state = m.state AND m.rn = 1
ORDER BY c.total_arr DESC;

-- 5️⃣ MODE PRESSURE ANALYSIS
CREATE OR REPLACE VIEW iccc_mode_pressure AS
SELECT 
    date AS time,
    SUM(CASE WHEN mode = 'flight' THEN arrivals ELSE 0 END) AS flight_inflow,
    SUM(CASE WHEN mode = 'train' THEN arrivals ELSE 0 END) AS train_inflow,
    SUM(CASE WHEN mode = 'bus' THEN arrivals ELSE 0 END) AS bus_inflow
FROM origin_breakdown
GROUP BY date
ORDER BY date ASC;

-- 6️⃣ LEAD-TIME VISIBILITY
CREATE OR REPLACE VIEW iccc_lead_time_visibility AS
SELECT 
    target_date AS date,
    SUM(arrival_count) AS confirmed_bookings
FROM booking_inflow
WHERE target_date >= CURRENT_DATE AND target_date <= CURRENT_DATE + interval '7 days'
GROUP BY target_date
ORDER BY target_date ASC;

-- 7️⃣ ZONE RISK MATRIX
CREATE OR REPLACE VIEW iccc_zone_matrix AS
WITH current_zones AS (
    SELECT zone, predicted_crowd, risk_level
    FROM zone_distribution
    WHERE date = (SELECT MAX(date) FROM zone_distribution)
),
past_zones AS (
    SELECT zone, predicted_crowd
    FROM zone_distribution
    WHERE date = (SELECT MAX(date) - interval '1 day' FROM zone_distribution)
)
SELECT 
    c.zone,
    c.predicted_crowd AS crowd,
    ROUND((c.predicted_crowd::numeric / 50000.0) * 100, 1) AS capacity_percent,  -- assuming 50k soft cap per major zone
    ROUND(((c.predicted_crowd - p.predicted_crowd)::numeric / NULLIF(p.predicted_crowd, 0)) * 100, 1) AS growth_percent,
    c.risk_level AS risk,
    CASE
        WHEN (c.predicted_crowd::numeric / 50000.0) >= 0.9 THEN 'Deploy Extra 150 Personnel'
        WHEN (c.predicted_crowd::numeric / 50000.0) >= 0.7 THEN 'Monitor Closely - Readiness Level 2'
        ELSE 'Normal Operations'
    END AS action_required
FROM current_zones c
LEFT JOIN past_zones p ON c.zone = p.zone
ORDER BY c.predicted_crowd DESC;

-- 8️⃣ OPERATIONAL CONSTRAINTS
CREATE OR REPLACE VIEW iccc_ops_constraints AS
SELECT 
    hotel_occupancy,
    rain_probability,
    social_buzz_index,
    CASE 
        WHEN hotel_occupancy > 0.9 THEN '🏨 Hotel Occupancy: ' || ROUND(hotel_occupancy::numeric * 100, 0) || '% (Critical)'
        WHEN hotel_occupancy > 0.8 THEN '🏨 Hotel Occupancy: ' || ROUND(hotel_occupancy::numeric * 100, 0) || '% (High)'
        ELSE '🏨 Hotel Occupancy: ' || ROUND(hotel_occupancy::numeric * 100, 0) || '% (Safe)'
    END AS hotel_status,
    CASE 
        WHEN rain_probability > 0.6 THEN '🌧️ Rain Probability: ' || ROUND(rain_probability::numeric * 100, 0) || '% (Divert from Beaches)'
        ELSE '🌧️ Rain Probability: ' || ROUND(rain_probability::numeric * 100, 0) || '% (No Diversion Needed)'
    END AS rain_status,
    CASE 
        WHEN social_buzz_index > 1.5 THEN '🔥 Social Buzz: Elevated – Trend Warning'
        ELSE '🔥 Social Buzz: Normal'
    END AS buzz_status
FROM daily_metrics
ORDER BY date DESC LIMIT 1;

-- 9️⃣ RETURN FLOW MONITORING
CREATE OR REPLACE VIEW iccc_return_flow AS
SELECT 
    date AS time,
    daily_arrivals - daily_departures AS net_change,
    CASE 
        WHEN (daily_arrivals - daily_departures) > 0 THEN '↑ Increasing'
        ELSE '↓ Declining'
    END AS trend_direction
FROM daily_estimation
ORDER BY date ASC;
