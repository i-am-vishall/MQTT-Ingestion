-- ICCC V3 PRESCRIPTIVE COMMAND VIEWS

DROP VIEW IF EXISTS iccc_v3_live_traffic CASCADE;
DROP VIEW IF EXISTS iccc_v3_surge_severity CASCADE;
DROP VIEW IF EXISTS iccc_v3_arrival_projection_total CASCADE;
DROP VIEW IF EXISTS iccc_v3_top_growth_driver CASCADE;
DROP VIEW IF EXISTS iccc_v3_lead_time_table CASCADE;
DROP VIEW IF EXISTS iccc_v3_zone_capacity CASCADE;
DROP VIEW IF EXISTS iccc_v3_time_segmentation CASCADE;
DROP VIEW IF EXISTS iccc_v3_weekend_vs_weekday_bar CASCADE;
DROP VIEW IF EXISTS iccc_v3_alert_banner CASCADE;
DROP VIEW IF EXISTS iccc_v3_deployment_recommendation CASCADE;
DROP VIEW IF EXISTS iccc_v3_beach_vs_city_occupancy CASCADE;

-- 1️⃣ Live Traffic Snapshot with Comparison & Utilization (Assuming 200k safe capacity)
CREATE OR REPLACE VIEW iccc_v3_live_traffic AS
WITH today_arrivals AS (
    SELECT COALESCE(SUM(arrival_count), 0) as count FROM booking_inflow WHERE target_date = CURRENT_DATE
),
yesterday_arrivals AS (
    SELECT COALESCE(SUM(arrival_count), 0) as count FROM booking_inflow WHERE target_date = CURRENT_DATE - 1
),
avg_7day_arrivals AS (
    SELECT COALESCE(AVG(daily_sum), 1) as avg_val FROM (
        SELECT SUM(arrival_count) as daily_sum FROM booking_inflow 
        WHERE target_date BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE - 1 GROUP BY target_date
    ) sq
),
active AS (
    SELECT active_crowd FROM daily_estimation ORDER BY date DESC LIMIT 1
)
SELECT 
    active.active_crowd AS total_active_tourists,
    ROUND((active.active_crowd::numeric / 200000.0) * 100, 1) AS utilization_percent,
    today_arrivals.count AS arrivals_today,
    ROUND(((today_arrivals.count - yesterday_arrivals.count)::numeric / NULLIF(yesterday_arrivals.count, 0)) * 100, 1) AS pct_change_yesterday,
    ROUND(((today_arrivals.count - avg_7day_arrivals.avg_val)::numeric / NULLIF(avg_7day_arrivals.avg_val, 0)) * 100, 1) AS pct_change_7day,
    CASE WHEN today_arrivals.count > yesterday_arrivals.count THEN '↑' ELSE '↓' END AS trend_icon_yesterday,
    CASE WHEN today_arrivals.count > avg_7day_arrivals.avg_val THEN '↑' ELSE '↓' END AS trend_icon_7day
FROM today_arrivals, yesterday_arrivals, avg_7day_arrivals, active;

-- 2️⃣ Surge Severity Indicator
CREATE OR REPLACE VIEW iccc_v3_surge_severity AS
WITH peak AS (
    SELECT projection_date, projected_crowd FROM projection_curve ORDER BY projected_crowd DESC LIMIT 1
),
normal AS (
    SELECT COALESCE(AVG(estimated_crowd), 1) as avg_crowd FROM daily_estimation WHERE date >= CURRENT_DATE - 14
)
SELECT 
    TO_CHAR(peak.projection_date, 'Mon DD') AS peak_date,
    peak.projected_crowd,
    ROUND(((peak.projected_crowd - normal.avg_crowd)::numeric / normal.avg_crowd) * 100, 1) AS surge_percent,
    CASE 
        WHEN ((peak.projected_crowd - normal.avg_crowd)::numeric / normal.avg_crowd) > 0.4 THEN '🚨 CRITICAL SURGE'
        WHEN ((peak.projected_crowd - normal.avg_crowd)::numeric / normal.avg_crowd) > 0.2 THEN '⚠️ HIGH SURGE'
        ELSE '✅ NORMAL PEAK'
    END AS severity_label
FROM peak, normal;

-- 3️⃣ 14-Day Arrival Projection (With Total Curve)
CREATE OR REPLACE VIEW iccc_v3_arrival_projection_total AS
SELECT 
    target_date AS date,
    SUM(CASE WHEN mode='flight' THEN arrival_count ELSE 0 END) AS flight,
    SUM(CASE WHEN mode='train' THEN arrival_count ELSE 0 END) AS train,
    SUM(CASE WHEN mode='bus' THEN arrival_count ELSE 0 END) AS bus,
    SUM(arrival_count) AS total_arrivals
FROM booking_inflow
WHERE target_date >= CURRENT_DATE AND target_date <= CURRENT_DATE + interval '14 days'
GROUP BY target_date
ORDER BY target_date ASC;

-- 4️⃣ Dominant Growth Driver
CREATE OR REPLACE VIEW iccc_v3_top_growth_driver AS
WITH recent AS (
    SELECT state, SUM(arrivals) as recent_arr FROM origin_breakdown WHERE date BETWEEN CURRENT_DATE - 3 AND CURRENT_DATE GROUP BY state
),
past AS (
    SELECT state, SUM(arrivals) as past_arr FROM origin_breakdown WHERE date BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE - 4 GROUP BY state
)
SELECT 
    '🚀 Top Growth State: ' || r.state || ' (+' || ROUND(((r.recent_arr - p.past_arr)::numeric / NULLIF(p.past_arr,0))*100, 1) || '%)' AS dominant_state_text,
    ROUND(((r.recent_arr - p.past_arr)::numeric / NULLIF(p.past_arr,0))*100, 1) AS growth_val
FROM recent r JOIN past p ON r.state = p.state
WHERE p.past_arr > 500
ORDER BY growth_val DESC LIMIT 1;

-- 5️⃣ Lead-Time Visibility Depth (Bookings confirmed today for future dates)
CREATE OR REPLACE VIEW iccc_v3_lead_time_table AS
WITH today_book AS (
    SELECT target_date, SUM(arrival_count) as total_today FROM booking_inflow WHERE booking_date = CURRENT_DATE AND target_date > CURRENT_DATE GROUP BY target_date
),
yesterday_book AS (
    SELECT target_date, SUM(arrival_count) as total_yest FROM booking_inflow WHERE booking_date = CURRENT_DATE - 1 AND target_date > CURRENT_DATE GROUP BY target_date
)
SELECT 
    t.target_date AS target_date,
    t.total_today AS bookings_confirmed,
    ROUND(((t.total_today - COALESCE(y.total_yest,0))::numeric / NULLIF(COALESCE(y.total_yest,0), 0))*100, 1) AS increase_vs_yesterday,
    CASE WHEN t.total_today > COALESCE(y.total_yest,0) THEN '↑ ' ELSE '↓ ' END || ROUND(((t.total_today - COALESCE(y.total_yest,0))::numeric / NULLIF(COALESCE(y.total_yest,0), 0))*100, 1) || '%' AS trend_text
FROM today_book t LEFT JOIN yesterday_book y ON t.target_date = y.target_date
ORDER BY t.target_date ASC
LIMIT 7;

-- 6️⃣ Zone Capacity %
CREATE OR REPLACE VIEW iccc_v3_zone_capacity AS
SELECT 
    zone,
    predicted_crowd,
    CASE WHEN zone IN ('Baga', 'Calangute', 'Vagator', 'Anjuna') THEN 45000 ELSE 60000 END AS soft_capacity,
    ROUND((predicted_crowd::numeric / CASE WHEN zone IN ('Baga', 'Calangute', 'Vagator', 'Anjuna') THEN 45000.0 ELSE 60000.0 END) * 100, 1) AS capacity_percent
FROM zone_distribution
WHERE date = CURRENT_DATE;

-- 7️⃣ Beach vs City Visual Grouping
CREATE OR REPLACE VIEW iccc_v3_beach_vs_city_occupancy AS
SELECT 
    CASE WHEN zone IN ('Baga', 'Calangute', 'Vagator', 'Anjuna') THEN 'Beach Zones' ELSE 'City/Cultural Zones' END AS region,
    SUM(predicted_crowd) AS total_occupancy,
    ROUND((SUM(predicted_crowd)::numeric / CASE WHEN zone IN ('Baga', 'Calangute', 'Vagator', 'Anjuna') THEN 180000.0 ELSE 80000.0 END) * 100, 1) AS region_capacity_percent
FROM zone_distribution
WHERE date = CURRENT_DATE
GROUP BY region;

-- 8️⃣ Prescriptive Time-of-Day Segmentation
CREATE OR REPLACE VIEW iccc_v3_time_segmentation AS
SELECT 
    '5PM–9PM' AS time_window,
    'Beach Belt' AS dominant_zone,
    'High' AS expected_load,
    'Traffic Diversion Required on Saligao Route' AS standard_action
UNION ALL
SELECT 
    '11AM–4PM',
    'Panaji City',
    'Moderate to High',
    'Deploy Extra Parking Wardens at Miramar'
UNION ALL
SELECT 
    '9PM–2AM',
    'Vagator/Anjuna',
    'High (Party Surge)',
    'Medical & Police Checkpoints Active';

-- 9️⃣ Weekend vs Weekday Bar Logic
CREATE OR REPLACE VIEW iccc_v3_weekend_vs_weekday_bar AS
SELECT 
    CASE WHEN zone IN ('Baga', 'Calangute', 'Vagator', 'Anjuna') THEN 'Beach Zones' ELSE 'City Zones' END AS region,
    CASE WHEN EXTRACT(DOW FROM date) IN (0, 6) THEN 'Weekend' ELSE 'Weekday' END AS day_type,
    ROUND(AVG(predicted_crowd)) AS avg_crowd
FROM zone_distribution
WHERE date >= (CURRENT_DATE - 14)
GROUP BY region, day_type
ORDER BY region, day_type;

-- 🔟 Alert Banner Escallation
CREATE OR REPLACE VIEW iccc_v3_alert_banner AS
WITH peak AS (
    SELECT projection_date, projected_crowd FROM projection_curve ORDER BY projected_crowd DESC LIMIT 1
)
SELECT 
    CASE 
        WHEN peak.projected_crowd > 180000 THEN '⚠️ HIGH TRAFFIC SURGE EXPECTED IN ' || (peak.projection_date - CURRENT_DATE) || ' DAYS – PREPARE DEPLOYMENT'
        ELSE '🟢 NORMAL OPERATIONS – NO CRITICAL SURGE DETECTED'
    END AS alert_message
FROM peak;

-- 1️⃣1️⃣ Recommended Action Deployment
CREATE OR REPLACE VIEW iccc_v3_deployment_recommendation AS
WITH peak AS (
    SELECT projected_crowd FROM projection_curve ORDER BY projected_crowd DESC LIMIT 1
)
SELECT 
    'Police Personnel' AS unit,
    CASE WHEN projected_crowd > 180000 THEN '+120' WHEN projected_crowd > 120000 THEN '+60' ELSE 'Normal' END AS required_deployment
FROM peak
UNION ALL
SELECT 
    'Traffic Units',
    CASE WHEN projected_crowd > 180000 THEN '+18' WHEN projected_crowd > 120000 THEN '+8' ELSE 'Normal' END
FROM peak
UNION ALL
SELECT 
    'Medical Stations',
    CASE WHEN projected_crowd > 180000 THEN '+4' WHEN projected_crowd > 120000 THEN '+2' ELSE 'Normal' END
FROM peak;
