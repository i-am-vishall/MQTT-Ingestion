-- 🏗️ Smart City ICCC V5 - Architecturally Strict Views

-- 🔥 Fix 1 & 2: Standardization & Anti-Null
CREATE OR REPLACE VIEW iccc_v5_live_traffic AS
WITH latest_estimation AS (
    SELECT date, daily_arrivals, daily_departures, active_crowd 
    FROM daily_estimation ORDER BY date DESC LIMIT 1
),
yesterday_estimation AS (
    SELECT daily_arrivals, active_crowd 
    FROM daily_estimation 
    WHERE date = (SELECT date FROM latest_estimation) - 1
),
avg_7day_arrivals AS (
    SELECT COALESCE(AVG(daily_arrivals), 1) as avg_val 
    FROM daily_estimation
    WHERE date BETWEEN (SELECT date FROM latest_estimation) - 7 AND (SELECT date FROM latest_estimation) - 1
)
SELECT 
    l.active_crowd AS total_active_tourists,
    ROUND((l.active_crowd::numeric / 1000000.0) * 100, 1) AS utilization_percent,  -- Haridwar roughly maxes at 1M
    l.daily_arrivals AS arrivals_today,
    ROUND(((l.daily_arrivals - COALESCE(y.daily_arrivals, 0))::numeric / NULLIF(COALESCE(y.daily_arrivals, 0), 0)) * 100, 1) AS pct_change_yesterday,
    ROUND(((l.daily_arrivals - a.avg_val)::numeric / NULLIF(a.avg_val, 0)) * 100, 1) AS pct_change_7day,
    CASE WHEN l.daily_arrivals > COALESCE(y.daily_arrivals, 0) THEN '↑' ELSE '↓' END AS trend_icon_yesterday,
    CASE WHEN l.daily_arrivals > a.avg_val THEN '↑' ELSE '↓' END AS trend_icon_7day
FROM latest_estimation l
LEFT JOIN yesterday_estimation y ON TRUE
CROSS JOIN avg_7day_arrivals a;

-- 🔥 Fix 6: Operational Alerts (Live Condition Based)
CREATE OR REPLACE VIEW iccc_v5_operational_alerts AS
WITH today_flight AS (
    SELECT COALESCE(SUM(arrival_count), 0) as total_curr FROM booking_inflow WHERE target_date = CURRENT_DATE AND mode = 'train'
),
yest_flight AS (
    SELECT COALESCE(SUM(arrival_count), 0) as total_past FROM booking_inflow WHERE target_date = CURRENT_DATE - 1 AND mode = 'train'
),
hotel AS (
    SELECT COALESCE(hotel_occupancy, 0.5) as occ FROM daily_metrics ORDER BY date DESC LIMIT 1
),
baga_crowd AS (
    SELECT COALESCE(predicted_crowd, 0) as crowd FROM zone_distribution WHERE date = CURRENT_DATE AND zone = 'Har Ki Pauri' LIMIT 1
),
active_metrics AS (
    SELECT active_crowd FROM daily_estimation WHERE date = CURRENT_DATE LIMIT 1
)
SELECT 
    CASE
        WHEN (SELECT total_curr FROM today_flight) > 20000 
             AND (((SELECT total_curr FROM today_flight) - COALESCE(NULLIF((SELECT total_past FROM yest_flight),0), 1))::numeric / COALESCE(NULLIF((SELECT total_past FROM yest_flight),0), 1)) > 0.15 
             AND COALESCE((SELECT active_crowd FROM active_metrics), 0) > 600000
             AND (SELECT occ FROM hotel) > 0.85
        THEN '🔴 TRANSIT CRITICAL: Peak Load + >600k Active + High Occ' 
        ELSE '🟢 Transit Flow Normal' 
    END AS airport_alert,
    
    CASE 
        WHEN (SELECT occ FROM hotel) > 0.92 
        THEN '🔴 ACCOMMODATION CRITICAL: Occupancy > 92%' 
        ELSE '🟢 Accommodation Available' 
    END AS hotel_alert,
    
    CASE 
        WHEN (SELECT crowd FROM baga_crowd) > 180000 
        THEN '🟠 SPILLOVER TRIGGERED: Har Ki Pauri > 180k (Redirecting to Subhash Ghat)' 
        ELSE '🟢 Har Ki Pauri Traffic Normal' 
    END AS spillover_alert;

-- 🔥 Fix 5: Dynamic Zone Capacity Risk
CREATE OR REPLACE VIEW iccc_v5_zone_capacity AS
WITH latest_metrics AS (
    SELECT date, COALESCE(hotel_occupancy, 0.5) as hotel_occ, COALESCE(rain_probability, 0.0) as rain FROM daily_metrics ORDER BY date DESC LIMIT 1
),
zones AS (
    SELECT zone, predicted_crowd FROM zone_distribution WHERE date = (SELECT date FROM latest_metrics)
)
SELECT 
    z.zone,
    z.predicted_crowd,
    -- Dynamic Capacity: Base * (1.5 - Hotel Occ) -> Higher the occupancy, the tighter the safe capacity feels
    ROUND(
        (CASE WHEN z.zone = 'Har Ki Pauri' THEN 200000.0 WHEN z.zone IN ('Subhash Ghat', 'Kusha Ghat') THEN 100000.0 ELSE 70000.0 END * (1.5 - m.hotel_occ))::numeric
    ) AS dynamic_capacity,
    ROUND(((z.predicted_crowd::numeric / 
        (CASE WHEN z.zone = 'Har Ki Pauri' THEN 200000.0 WHEN z.zone IN ('Subhash Ghat', 'Kusha Ghat') THEN 100000.0 ELSE 70000.0 END * (1.5 - m.hotel_occ))::numeric
    ) * 100)::numeric, 1) AS dynamic_capacity_percent
FROM zones z
CROSS JOIN latest_metrics m;

-- 🔥 Fix 7: Integrated Time-of-Day Reallocation Model
CREATE OR REPLACE VIEW iccc_v5_time_of_day_distribution AS
WITH base_date AS (
    SELECT MAX(date) as curr_date FROM daily_estimation
)
SELECT 
    b.curr_date AS date,
    h.hour_block,
    z.zone,
    -- Logic: Weekends push crowd to beaches in the evening, Weekdays to cities in the day
    ROUND(z.predicted_crowd * h.base_weight * 
        CASE 
            WHEN EXTRACT(DOW FROM b.curr_date) IN (0, 6) AND z.zone IN ('Har Ki Pauri', 'Subhash Ghat', 'Kusha Ghat') AND h.hour_block >= 17 THEN 1.4
            WHEN EXTRACT(DOW FROM b.curr_date) NOT IN (0, 6) AND z.zone = 'Others' AND h.hour_block BETWEEN 10 AND 16 THEN 1.3
            ELSE 1.0
        END
    ) AS hourly_expected_crowd
FROM zone_distribution z
CROSS JOIN base_date b
CROSS JOIN (
    VALUES 
        (8, 0.05), (10, 0.10), (12, 0.15), 
        (15, 0.15), (18, 0.25), (21, 0.20), (23, 0.10)
) AS h(hour_block, base_weight)
WHERE z.date = b.curr_date;

-- 🔥 Fix 8: Origin Intelligence Depth
CREATE OR REPLACE VIEW iccc_v5_origin_intelligence AS
WITH latest_origins AS (
    SELECT origin_city, 
           CASE 
               WHEN origin_city = 'Delhi' OR origin_city = 'DL' THEN 'Delhi'
               WHEN origin_city = 'Lucknow' OR origin_city = 'UP' OR origin_city LIKE 'U0%' THEN 'UP'
               WHEN origin_city = 'Chandigarh' OR origin_city = 'HR' THEN 'Haryana'
               WHEN origin_city = 'Amritsar' OR origin_city = 'PB' THEN 'Punjab'
               WHEN origin_city = 'Dehradun' OR origin_city = 'UK' OR origin_city = 'UA' THEN 'Uttarakhand'
               WHEN origin_city = 'Jaipur' OR origin_city = 'RJ' THEN 'Rajasthan'
               ELSE 'Various' 
           END as state,
           mode, SUM(arrival_count) as total_arrivals
    FROM booking_inflow
    WHERE target_date >= CURRENT_DATE AND target_date <= CURRENT_DATE + 3
    GROUP BY origin_city, mode
),
ranked_cities AS (
    SELECT origin_city, state, mode, total_arrivals,
           RANK() OVER(PARTITION BY origin_city ORDER BY total_arrivals DESC) as rnk
    FROM latest_origins
)
SELECT 
    origin_city AS city,
    state,
    SUM(total_arrivals) AS upcoming_arrivals,
    MAX(CASE WHEN rnk = 1 THEN mode ELSE NULL END) AS dominant_mode,
    CASE 
        WHEN SUM(total_arrivals) > 2000 THEN '🔴 High Risk Source'
        WHEN SUM(total_arrivals) > 1000 THEN '🟠 Med Risk Source'
        ELSE '🟢 Standard'
    END AS origin_risk
FROM ranked_cities
GROUP BY origin_city, state
ORDER BY upcoming_arrivals DESC;
