# 🏙️ Predictive Crowd Intelligence Module Guide

This module is a real-time, demand-based dynamic engine built to estimate active crowds, detect weekend/festival impacts, project crowd momentum for the next 10 days, and distribute crowds across specific zones (like beaches or cities in Goa).

---

## 🚀 1. How to Run the System

I have bundled everything into a single startup script for you.

### **Option 1: The One-Click Startup**
1. Open a terminal or file explorer in `C:\Users\mevis\MQTT-Ingetsion`.
2. Double-click or run:
   ```bat
   Start_Crowd_Services.bat
   ```
   *What this does:* It drops into the `crowd-prediction-engine` folder, activates the Python environment, installs dependencies, and launches the **FastAPI Server** (`api.py`) and the **Data Simulator** (`simulator.py`) in tandem.

### **Option 2: Running Manually**
If you want to run the components independently:
1. Open a terminal in `C:\Users\mevis\MQTT-Ingetsion\crowd-prediction-engine`.
2. **Start the API & Logic Engine:**
   ```bash
   venv\Scripts\activate
   python api.py
   ```
   *(This starts the web server on `http://localhost:8000`. Every time a payload hits `/api/v1/booking/inflow`, the `engine.py` logic calculates the crowd and saves it to PostgreSQL.)*
   
3. **Start the Synthetic Simulator (in a new terminal):**
   ```bash
   venv\Scripts\activate
   python simulator.py
   ```
   *(This script endlessly generates random booking data for Trains, Flights, Buses, and Hotels, and POSTs it to the API every 3 seconds).*

---

## 🧠 2. How it Works (What We Built)

The module is broken into three main Python files under `crowd-prediction-engine/`:

- **`api.py` (The Receiver):** A blazing-fast REST API built with FastAPI. It listens for incoming JSON payloads representing booking inflows.
- **`engine.py` (The Brains):** 
   - Receives the booking data.
   - Applies *Weather Sentiment* (e.g. Heavy Rain reduces crowds by 40%).
   - Detects *Anomalies* (calculates 14-day rolling standard deviations to spot massive unusual spikes).
   - Generates a *10-day Projection* with a mathematical decay factor.
   - Distributes the crowd dynamically across 4 core zones (Baga, Calangute, Anjuna, Panaji) based on the "Vibe" of the day.
   - Saves all this to the PostgreSQL database (`mqtt_alerts_db`).
- **`simulator.py` (The Fake Data Generator):** Since we don't have a live API from MakeMyTrip or IRCTC, this script loops continuously, generating fake but highly realistic booking numbers to feed the engine.

---

## 📊 3. How to Show it on Grafana

Now that the simulator is running and dumping thousands of records into your PostgreSQL database, it's time to visualize it!

### **Step A: Connect the Database**
1. Open Grafana (`http://localhost:3000`).
2. Go to **Connections > Data Sources > Add data source**.
3. Select **PostgreSQL**.
4. Set the host to `localhost:5441`.
5. Database: `mqtt_alerts_db`.
6. User: `postgres` (Leave password blank if none).
7. Scroll down and click **Save & Test**.

### **Step B: Build the Dashboard Panels**
Create a new Dashboard. Click **Add Visualization**, select PostgreSQL, and use the following SQL queries to build your charts:

#### 📈 Panel 1: Real-Time Active Crowd (Time Series Line Chart)
*Visualizes the surging crowd day by day.*
```sql
SELECT 
    date AS "time",
    active_crowd AS "Total Crowd"
FROM daily_estimation
ORDER BY date ASC;
```

#### 🚨 Panel 2: Live Risk Classification (Stat / Gauge Panel)
*Shows current danger levels (Low, Moderate, High, Severe).*
```sql
SELECT 
    risk_level
FROM daily_estimation 
ORDER BY date DESC 
LIMIT 1;
```
*(Color mapping in Grafana: Green = Low, Yellow = Moderate, Orange = High, Red = Severe).*

#### 🔮 Panel 3: 10-Day Projections (Bar Chart)
*Shows projected crowd momentum.*
```sql
SELECT 
    projection_date AS "time",
    projected_crowd AS "Estimated Crowd"
FROM projection_10_days
ORDER BY projection_date ASC;
```

#### 🗺️ Panel 4: Live Zone Distribution (Pie Chart or Bar Gauge)
*Shows where the crowd is currently localized.*
```sql
SELECT 
    zone AS metric,
    predicted_crowd AS value
FROM zone_distribution
WHERE date = (SELECT MAX(date) FROM zone_distribution);
```

#### 🌦️ Panel 5: Weather Sentiment Impact (Table)
*Shows the current weather profile affecting the crowd.*
```sql
SELECT 
    date as "Date",
    weather_sentiment as "Weather Event",
    multiplier as "Impact Multiplier"
FROM daily_estimation
ORDER BY date DESC
LIMIT 7;
```

With these 5 queries, you will have an incredible, enterprise-grade Predictive Intelligence dashboard running live!
