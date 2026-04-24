-- 🏗️ Smart City ICCC - Additional Intelligent Views for Direct Questions

-- ROW 1 Views (Live Traffic Snapshot)
CREATE OR REPLACE VIEW iccc_today_new_bookings AS
SELECT SUM(arrival_count) AS total_bookings
FROM booking_inflow
WHERE booking_date = CURRENT_DATE;

CREATE OR REPLACE VIEW iccc_today_expected_arrivals AS
SELECT daily_arrivals
FROM daily_estimation
WHERE date = CURRENT_DATE;

CREATE OR REPLACE VIEW iccc_today_mode_split AS
SELECT mode, SUM(arrival_count) AS arrivals
FROM booking_inflow
WHERE target_date = CURRENT_DATE
GROUP BY mode;

-- ROW 2 Views (Day-Wise Surge Analysis)
CREATE OR REPLACE VIEW iccc_14day_arrival_projection AS
SELECT 
    target_date AS date,
    SUM(CASE WHEN mode='flight' THEN arrival_count ELSE 0 END) AS flight,
    SUM(CASE WHEN mode='train' THEN arrival_count ELSE 0 END) AS train,
    SUM(CASE WHEN mode='bus' THEN arrival_count ELSE 0 END) AS bus
FROM booking_inflow
WHERE target_date >= CURRENT_DATE AND target_date <= CURRENT_DATE + interval '14 days'
GROUP BY target_date
ORDER BY target_date ASC;

CREATE OR REPLACE VIEW iccc_peak_surge_day AS
SELECT target_date AS peak_date, SUM(arrival_count) AS max_arrivals
FROM booking_inflow
WHERE target_date >= CURRENT_DATE
GROUP BY target_date
ORDER BY max_arrivals DESC
LIMIT 1;

-- ROW 3 Views (Origin Intelligence)
CREATE OR REPLACE VIEW iccc_today_source_city AS
SELECT 
    origin_city,
    mode,
    SUM(arrival_count) AS total
FROM booking_inflow
WHERE booking_date = CURRENT_DATE
GROUP BY origin_city, mode
ORDER BY total DESC;

CREATE OR REPLACE VIEW iccc_next_7_days_state_share AS
SELECT 
    state,
    SUM(arrivals) AS total_arrivals
FROM origin_breakdown
WHERE date BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '7 days'
GROUP BY state;

-- ROW 4 Views (Zone Occupancy & Time-of-Day)
CREATE OR REPLACE VIEW iccc_zone_occupancy_72h AS
SELECT 
    zone,
    SUM(predicted_crowd) AS total_predicted_crowd
FROM zone_distribution
WHERE date BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '3 days'
GROUP BY zone
ORDER BY total_predicted_crowd DESC;

CREATE OR REPLACE VIEW iccc_time_of_day_rush AS
SELECT 
    date AS current_date,
    CASE 
        WHEN EXTRACT(DOW FROM date) IN (0, 6) THEN 'Evening 5PM–10PM (Beach Belt Rush)'
        ELSE 'Midday 11AM–4PM (City & Heritage Rush)'
    END AS peak_time_window,
    CASE 
        WHEN EXTRACT(DOW FROM date) IN (0, 6) THEN 'High Congestion in Baga, Calangute, Vagator'
        ELSE 'Moderate Congestion in Panaji, Old Goa'
    END AS operational_impact
FROM daily_estimation
WHERE date = CURRENT_DATE;

-- ROW 5 Views (Weekend vs Weekday Zone Load)
CREATE OR REPLACE VIEW iccc_weekend_weekday_load AS
SELECT 
    CASE WHEN EXTRACT(DOW FROM date) IN (0, 6) THEN 'Weekend' ELSE 'Weekday' END AS day_type,
    zone,
    ROUND(AVG(predicted_crowd)) AS avg_crowd
FROM zone_distribution
GROUP BY day_type, zone
ORDER BY day_type DESC, avg_crowd DESC;
