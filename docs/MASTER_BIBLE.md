# 📖 I2V MQTT Ingestion System — Complete Project Bible

> **This is the single source of truth for the entire I2V MQTT Ingestion stack.**
> Every change, every version, every architectural decision — documented from scratch to production.

---

## 📚 Documentation Index

| File | What It Covers |
|------|---------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, data flow diagrams, component map |
| [CODEBASE_REFERENCE.md](./CODEBASE_REFERENCE.md) | Every file explained — what it does, why it exists |
| [CHANGELOG.md](./CHANGELOG.md) | Complete version history — every change ever made, v0 → current |
| [DATABASE_BIBLE.md](./DATABASE_BIBLE.md) | Every table, index, partition, trigger, view — fully documented |
| [CONFIG_REFERENCE.md](./CONFIG_REFERENCE.md) | Every `.env` variable — what it does, defaults, impact |
| [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md) | How to install, run, debug, restart, and maintain the system |

---

## 🚀 Quick Summary (For Humans and AIs)

This system is a **real-time MQTT ingestion pipeline** built for **I2V Systems** — a surveillance and smart city platform. It:

1. Connects to **multiple MQTT brokers** (VMS servers, ANPR servers, local broker)
2. Receives **JSON events** from IP cameras (ANPR, FRS, Crowd, ATCC, VIDS)
3. **Normalizes and classifies** every event into a canonical schema
4. **Batches and writes** events to **PostgreSQL** (with optional Redis buffering)
5. Maintains **live camera state**, **fact tables**, and **1-minute metric buckets**
6. Runs **self-healing watchdogs** and **data retention jobs** autonomously
7. Exposes a **Config UI** (React + Node.js) for live configuration
8. Runs as a **Windows Service** via NSSM

**Production Location:** `C:\Program Files (x86)\i2v-MQTT-Ingestion\`
**GitHub:** `https://github.com/i-am-vishall/MQTT-Ingestion`

---

## 🗓️ Project Timeline Summary

| Phase | What Happened |
|-------|--------------|
| **Phase 0** | Basic MQTT → PostgreSQL single-file script |
| **Phase 1** | Multi-broker support, event normalization module |
| **Phase 2** | ANPR/FRS fact tables, live camera state |
| **Phase 3** | Redis shock absorber, circuit breaker, load monitor |
| **Phase 4** | Config UI built (React + Node.js backend) |
| **Phase 5** | Windows Service packaging (NSSM + pkg) |
| **Phase 6** | ICCC Architecture upgrade — camera registry, geo-data |
| **Phase 7** | Data retention (30-day cleanup) + auto-partition |

---

*Last Updated: 2026-05-14 | Maintained by: Vishal / I2V Systems*
