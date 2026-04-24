-- 🏗️ Smart City ICCC V4 - Master Dashboard Structure Views

-- 6️⃣ Mobility & Operational Alerts
CREATE OR REPLACE VIEW iccc_v4_operational_alerts AS
WITH latest_bus AS (
    SELECT COALESCE(SUM(arrival_count), 0) as total_bus FROM booking_inflow WHERE target_date = CURRENT_DATE AND mode = 'bus'
),
latest_flight AS (
    SELECT COALESCE(SUM(arrival_count), 0) as total_flight FROM booking_inflow WHERE target_date = CURRENT_DATE AND mode = 'flight'
),
hotel AS (
    SELECT hotel_occupancy FROM daily_metrics ORDER BY date DESC LIMIT 1
),
baga_crowd AS (
    SELECT predicted_crowd FROM zone_distribution WHERE date = CURRENT_DATE AND zone = 'Baga' LIMIT 1
)
SELECT 
    CASE WHEN (SELECT total_bus FROM latest_bus) > 4000 THEN '🔴 HIGHWAY CONGESTION RISK: Bus arrivals surging > 4k' ELSE '🟢 Highway Traffic Flowing Normal' END AS highway_alert,
    CASE WHEN (SELECT total_flight FROM latest_flight) > 7000 THEN '🔴 AIRPORT PEAK LOAD: Flight arrivals surging > 7k' ELSE '🟢 Airport Operations Normal' END AS airport_alert,
    CASE WHEN (SELECT hotel_occupancy FROM hotel) > 0.95 THEN '🔴 ACCOMMODATION SATURATED: Occupancy > 95%' ELSE '🟢 Accommodation Available' END AS hotel_alert,
    CASE WHEN COALESCE((SELECT predicted_crowd FROM baga_crowd), 0) > 45000 THEN '🟠 CONGESTION SPILLOVER: Diverting Baga traffic to Candolim' ELSE '🟢 Baga Traffic Normal' END AS spillover_alert;

-- 8️⃣ Confidence & Volatility Panel
CREATE OR REPLACE VIEW iccc_v4_model_health AS
SELECT
    confidence_score AS data_stability_index,
    ROUND(100 - confidence_score) AS forecast_volatility,
    CASE 
        WHEN confidence_score < 60 THEN '⚠️ HIGH DRIFT' 
        WHEN confidence_score < 75 THEN '🟠 MODERATE DRIFT' 
        ELSE '🟢 MODEL STABLE' 
    END AS model_drift_alert
FROM daily_estimation
ORDER BY date DESC LIMIT 1;

-- 5️⃣ Festival Intelligence Section
CREATE OR REPLACE VIEW iccc_v4_festival_intelligence AS
SELECT 
    de.date as date,
    de.event_multiplier AS festival_logistic_curve,
    dm.social_buzz_index AS social_buzz_index,
    CASE WHEN EXTRACT(MONTH FROM de.date) = 3 AND EXTRACT(DAY FROM de.date) BETWEEN 12 AND 15 THEN 'HOLI SURGE ACTIVE (Party Zones)' ELSE 'Monitoring' END AS holi_impact,
    CASE WHEN EXTRACT(MONTH FROM de.date) = 3 AND EXTRACT(DAY FROM de.date) BETWEEN 5 AND 10 THEN 'SHIGMO SURGE ACTIVE (Panaji)' ELSE 'Monitoring' END AS shigmo_impact
FROM daily_estimation de
LEFT JOIN daily_metrics dm ON de.date = dm.date
WHERE de.date >= CURRENT_DATE AND de.date <= CURRENT_DATE + interval '14 days'
ORDER BY de.date ASC;
