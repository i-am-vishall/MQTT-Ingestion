# .env updates needed for Single-Server Resilient Architecture

# === NEW: Redis Stream Settings ===
REDIS_STREAM_NAME=mqtt:ingest
REDIS_STREAM_MAXLEN=3000000
REDIS_CONSUMER_GROUP=workers

# === NEW: Backpressure / Circuit Breaker Thresholds ===
# Yellow: Start probabilistic dropping of non-critical events
BACKPRESSURE_YELLOW=1000000
# Red: Unsubscribe from all non-critical topics (only process ALERTS)
BACKPRESSURE_RED=2500000

# === UPDATED: DB Tuning Limit ===
DB_POOL_MAX=20
BATCH_SIZE=2000
BATCH_TIMEOUT=3000
