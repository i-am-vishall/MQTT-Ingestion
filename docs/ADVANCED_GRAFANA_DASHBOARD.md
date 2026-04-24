# 📊 ADVANCED GRAFANA DASHBOARD QUERIES (10-Point Model)

Welcome to the **Goa Festival Mobility Intelligence – March 2026** master dashboard setup. 
Because your application has been upgraded to a highly advanced 10-point analytics engine, the database schema now holds predictive forward lead-times, origin breakdown logic, return flow (departures), and weather modifiers.

Follow this guide to build out your exact **8-Section Dashboard** in Grafana.

---

## 1️⃣ Executive Overview Panel (Top Section)
For your top-level KPI cards, place these individual "Stat" panels.

**Current Active Crowd:**
```sql
SELECT active_crowd AS value 
FROM daily_estimation 
ORDER BY date DESC LIMIT 1;
```

**Projected Peak Crowd (Upcoming):**
```sql
SELECT MAX(projected_crowd) AS value 
FROM projection_curve;
```

**Peak Window (Date of Peak):**
```sql
SELECT projection_date AS value 
FROM projection_curve 
ORDER BY projected_crowd DESC LIMIT 1;
```

**Current Risk Level:**
```sql
SELECT risk_level AS value 
FROM daily_estimation 
ORDER BY date DESC LIMIT 1;
```

**Confidence Score:**
```sql
SELECT confidence_score AS value 
FROM daily_estimation 
ORDER BY date DESC LIMIT 1;
```

---

## 2️⃣ Crowd Projection Curve (Core Predictive Panel)
Use a **Time Series (Line Graph)** visualization. This query perfectly merges the 30-day historical/live data with the upcoming curve up to March 18th.

```sql
SELECT date AS "time", estimated_crowd AS "Actual/Live Crowd"
FROM daily_estimation
UNION ALL
SELECT projection_date AS "time", projected_crowd AS "AI Projected Crowd"
FROM projection_curve
ORDER BY "time" ASC;
```

---

## 3️⃣ Origin Intelligence Section

**A. State Contribution (Pie Chart)**
*Visualizes exactly where people are arriving from today.*
```sql
SELECT 
  state as metric, 
  SUM(arrivals) as value 
FROM origin_breakdown 
WHERE date = (SELECT MAX(date) FROM origin_breakdown)
GROUP BY state;
```

**B. Top Feeder Cities (Table)**
```sql
SELECT 
  origin_city as "City", 
  mode as "Transport Mode", 
  SUM(arrivals) as "Total Arrivals"
FROM origin_breakdown 
WHERE date = (SELECT MAX(date) FROM origin_breakdown)
GROUP BY origin_city, mode
ORDER BY "Total Arrivals" DESC
LIMIT 5;
```

**C. Mode Share Trend (Time Series - Stacked Bar)**
```sql
SELECT 
    date AS "time",
    mode AS "metric",
    SUM(arrivals) AS "value"
FROM origin_breakdown
GROUP BY date, mode
ORDER BY date ASC;
```

---

## 4️⃣ Zone-Level Risk Map
Use a **Bar Gauge** or **Table** view. Shows exactly which beaches or cities are congested right now.

```sql
SELECT 
  zone as "Zone", 
  predicted_crowd as "Live Expected Crowd", 
  risk_level as "Congestion Risk"
FROM zone_distribution
WHERE date = (SELECT MAX(date) FROM zone_distribution)
ORDER BY predicted_crowd DESC;
```

---

## 5️⃣ Festival & Weather Intelligence

**A. Social Buzz & Weather Limits (Stat/Gauge)**
```sql
SELECT 
  hotel_occupancy as "Hotel Limits",
  rain_probability as "Rain Factor",
  social_buzz_index as "Social Buzz Index"
FROM daily_metrics
ORDER BY date DESC LIMIT 1;
```

**B. Logistic Event Buildup Curve (Time Series)**
*Shows the mathematical intensity curve calculating the hype leading up to a festival.*
```sql
SELECT 
    date as "time",
    event_multiplier as "Event Hype Curve"
FROM daily_estimation
ORDER BY date ASC;
```

---

## 6️⃣ Mobility & Return Flow Models

**A. Arrivals vs Departures (Time Series - Bar Graph)**
*Because the predictive capability now tracks the fact that tourist holidays **end**, this will show precisely when Goa starts emptying out.*
```sql
SELECT 
  date as "time", 
  daily_arrivals as "Inflow (Entering)", 
  daily_departures * -1 as "Outflow (Leaving)"
FROM daily_estimation
ORDER BY date ASC;
```

---

## 7️⃣ Confidence & Volatility Metrics
*Models the AI's internal confidence parameter regarding its predictions.*

```sql
SELECT 
  date as "time", 
  confidence_score as "Data Density Confidence %"
FROM daily_estimation
UNION ALL
SELECT 
  projection_date as "time", 
  confidence_score as "Expected Projective Confidence %"
FROM projection_curve
ORDER BY "time" ASC;
```
