# ATV Super Controller

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

Android TV scheduler and controller - automate your Android TV over LAN via ADB TCP.

## ✨ Features

- **🎮 Device Control** - Wake up, sleep, launch apps, play YouTube videos
- **⏰ Task Scheduling** - Schedule tasks using standard cron syntax
- **🌐 Web UI** - Browser-based dashboard with real-time status
- **🔌 Auto-Reconnect** - Robust ADB connection handling
- **🐳 Docker Support** - Run in container with health checks

## 📋 Prerequisites

1. **Android TV with ADB Debugging enabled**
   - Settings → Device Preferences → About → Build (click 7 times)
   - Settings → Device Preferences → Developer options → Network debugging → ON

2. **Node.js 18+** or **Docker**

## 🚀 Quick Start

### Option 1: Node.js

```bash
# Clone the repository
git clone https://github.com/LINSUISHENG034/ATV-Super-Controller.git
cd ATV-Super-Controller

# Install dependencies
npm install

# Configure your device
mkdir -p config
cp config/config.example.json config/config.json
# Edit config/config.json with your TV's IP address

# Start the service
npm start
```

### Option 2: Docker

```bash
# Copy and configure
mkdir -p config
cp config/config.example.json config/config.json

# Build the image
docker build -t atv-super-controller:latest .

# Run with Docker Compose
docker-compose up -d
```

## 🖥️ Web UI

Access the web dashboard at `http://localhost:3000` after starting the service.

| Dashboard          | Remote Control      | Task Management   |
| ------------------ | ------------------- | ----------------- |
| View device status | D-Pad navigation    | Create/edit tasks |
| Quick actions      | Live screen preview | Toggle schedules  |

## ⚙️ Configuration

Create `config/config.json` from the example:

```json
{
  "device": {
    "ip": "192.168.1.100",
    "port": 5555
  },
  "tasks": [
    {
      "name": "morning-video",
      "schedule": "0 30 7 * * *",
      "actions": [
        { "type": "wake" },
        { "type": "wait", "duration": 5000 },
        { "type": "play-video", "url": "https://youtube.com/watch?v=..." }
      ]
    }
  ]
}
```

### Available Actions

| Action       | Description                |
| ------------ | -------------------------- |
| `wake`       | Wake device from sleep     |
| `shutdown`   | Power off device           |
| `launch-app` | Launch app by package name |
| `play-video` | Open YouTube video URL     |
| `wait`       | Delay between actions      |

## 📁 Project Structure

```
src/
├── commands/     # CLI command implementations
├── services/     # Core logic (ADB, Scheduler, WebServer)
├── actions/      # Action strategies (wake, play-video, etc.)
├── api/          # REST API routes
├── websocket/    # WebSocket handlers
├── web/          # Static web UI files
└── utils/        # Utilities (Logger, Config)
```


## 🔬 Keepalive Probe

Use the Docker-based probe to verify whether a read-only keepalive pattern keeps ADB connected **without waking the TV screen**.

```bash
# Run a 6-hour experiment with 30-second sampling
docker compose --profile probe run --rm atv-keepalive-probe \
  probe-keepalive \
  --duration-ms 21600000 \
  --interval-ms 30000

# Print the latest run report
docker compose --profile probe run --rm atv-keepalive-probe probe-report
```

Detailed usage lives in `docs/experiments/keepalive-probe.md`.

## 🧪 Testing

```bash
# Run tests
npm test

# Test device connection
node src/index.js test

# Validate configuration
node src/index.js validate
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
