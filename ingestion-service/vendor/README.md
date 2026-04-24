# Vendor — Bundled Binaries

This folder contains **pre-compiled platform binaries** that the production deployment
requires. All dependencies here are for **Windows x64** and ship inside the installer
so that the server does **not** need any external software pre-installed.

---

## mosquitto/

Eclipse Mosquitto MQTT Broker — used by the stress test as a local test broker.

| File | Purpose |
|------|---------|
| `mosquitto.exe` | Main broker executable |
| `mosquitto.dll` | Core library |
| `libcrypto-1_1-x64.dll` | OpenSSL crypto (required by mosquitto) |
| `libssl-1_1-x64.dll` | OpenSSL TLS (required by mosquitto) |

**Source version:** Mosquitto 2.x for Windows x64  
**License:** Eclipse Public License 2.0  
**Update procedure:** Copy the 4 files from a fresh Mosquitto installer and replace here.

> **Note:** `findMosquitto.js` (`utils/findMosquitto.js`) resolves the executable path
> automatically. Code should never hardcode paths — always call `findMosquitto()`.

---

## redis/ (optional)

If Memurai / Redis is not installed as a Windows service, a portable build of
`redis-server.exe` can be placed here for standalone operation.

---

## How paths are resolved (priority order)

1. `ingestion-service/vendor/mosquitto/mosquitto.exe` ← **bundled (this folder)**
2. `C:\Program Files (x86)\i2v-MQTT-Ingestion\vendor\mosquitto\mosquitto.exe` ← production install
3. `C:\Program Files\mosquitto\mosquitto.exe` ← system install
4. `mosquitto` ← system PATH (last resort)
