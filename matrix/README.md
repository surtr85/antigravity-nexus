# ⚡️ Antigravity Matrix Bridge

A lightweight, enterprise-grade, end-to-end encrypted bridge that connects **Google Antigravity (`agy`)** directly to a **Matrix homeserver**, allowing you to chat, execute code, run slash commands, and analyze multimodal images directly from any Matrix client (Element, FluffyChat, Cinny, SchildiChat, etc.).

---

## ✨ Key Features

- 🔐 **End-to-End Encryption (E2EE)**: Full support for encrypted Matrix rooms via `vodozemac` / Megolm ratchets.
- 🛡️ **Automated Cross-Signing Self-Verification (SSSS)**: Automatically decrypts the account's Self-Signing Key (SSK) using `MATRIX_RECOVERY_KEY` and signs the bot session for a permanent **Green Shield (Verified 🛡️)** status.
- 🤝 **Interactive SAS Emoji Verification**: MSC2241 & MSC2366 compliant interactive device-to-device verification with emoji matching.
- 🔒 **Access Control Allowlist (`MATRIX_ALLOWED_USERS`)**: Restricts invitations, slash commands, message processing, image attachments, and verification requests exclusively to authorized Matrix accounts.
- 🖼️ **Multimodal Vision**: Upload screenshots or images directly in Matrix chat (encrypted or unencrypted); the bridge decrypts and feeds them to Antigravity.
- 💬 **Live Typing Indicators & Status Reactions**: Real-time `typing...` indicators and `⚙️` (processing) / `✅` (completed) reactions.
- 🎨 **Rich Formatting**: Beautiful HTML Markdown tables, syntax-highlighted code blocks, and formatted lists.
- 🧠 **Dynamic Directory & Memory Preservation**: Switch workspace directories with `/dir` while maintaining 100% of your ongoing conversation history and memory.
- 🚪 **Synapse v3 Auto-Join & Greetings**: Automatic room invitation acceptance with introductory command greeting.
- 🔒 **Zero Hardcoded Secrets**: Fully configurable via standard `.env` environment variables.

---

## ⚡️ Supported Slash Commands

| Command | Aliases | Description |
| :--- | :--- | :--- |
| **`/help`** | `/commands` | Display detailed command reference manual. |
| **`/stop`** | `/cancel`, `/interrupt` | Immediately cancel and interrupt the currently running agent task. |
| **`/dir [path]`** | `/cd`, `/pwd`, `/workspace` | View or change the active working directory for this room. |
| **`/new`** | `/reset`, `/clear` | Start a brand-new conversation session for the room. |
| **`/model [name]`** | `/models` | View available models or switch model (e.g. `/model claude-sonnet-4-6`). |
| **`/system [prompt]`** | `/persona` | View or set custom system instructions / persona for this room. |
| **`/tools [on\|off]`** | `/tool` | Toggle workspace tool execution permissions from chat. |
| **`/usage`** | `/quota`, `/stats` | View account limits, active tokens, and remaining quota with progress bars. |
| **`/skills`** | `/skill` | List all installed Antigravity skills and custom workflows. |
| **`/mcp`** | `/mcps` | List configured Model Context Protocol (MCP) servers and tools. |

---

## 🚀 Quick Setup

### Prerequisites
1. **Python 3.10+** (Tested on Python 3.10 – 3.14)
2. **Google Antigravity** installed and authenticated (`agy` CLI in PATH or `~/.local/bin/agy`).

### 1. Configuration
Copy the template configuration and set your Matrix credentials:
```bash
cp .env.example .env
nano .env
```

Example `.env` configuration:
```env
# Matrix Homeserver & Bot Credentials
MATRIX_HOMESERVER=https://matrix.example.com
MATRIX_USERNAME=your_bot_username
MATRIX_PASSWORD=your_secure_password

# Access Control: Comma-separated list of authorized Matrix User IDs
MATRIX_ALLOWED_USERS=@your_username:matrix.example.com

# Matrix Recovery Key for E2EE Key Backup & Secure Secret Storage (SSSS)
MATRIX_RECOVERY_KEY="EsTc xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx"

# Optional: Path to custom agy binary
AGY_BIN=/path/to/agy
```

### 2. 1-Click Automated Installation
Run the automated installer script:
```bash
./setup.sh
```
The script will automatically create the `matrix-env` virtual environment, install dependencies, and configure the background `systemd` user service (`antigravity-matrix.service`).

---

## 🛠️ Manual Setup

If you prefer to configure manually without `setup.sh`:

```bash
# 1. Create virtual environment
python3 -m venv matrix-env

# 2. Install dependencies
matrix-env/bin/pip install -r requirements.txt --prefer-binary

# 3. Make runner executable
chmod +x run_bridge.sh

# 4. Start the bridge:
./run_bridge.sh
```

---

## ⚙️ Background Daemon (systemd)

To ensure the bridge runs continuously and starts on boot:

```bash
# 1. Create systemd unit file
mkdir -p ~/.config/systemd/user
cat << EOF > ~/.config/systemd/user/antigravity-matrix.service
[Unit]
Description=Antigravity Matrix Chat Bridge
After=network.target

[Service]
Type=simple
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/run_bridge.sh
Restart=always
RestartSec=5s

[Install]
WantedBy=default.target
EOF

# 2. Enable and start service
systemctl --user daemon-reload
systemctl --user enable --now antigravity-matrix.service
```

### Managing the Service
- **Check Status**: `systemctl --user status antigravity-matrix.service`
- **View Live Logs**: `journalctl --user -u antigravity-matrix.service -f`
- **Restart Service**: `systemctl --user restart antigravity-matrix.service`
- **Stop Service**: `systemctl --user stop antigravity-matrix.service`

---

## 📂 Directory Layout

```
matrix/
├── README.md                     # Documentation & setup guide
├── requirements.txt              # Python package dependencies
├── setup.sh                      # 1-click automated setup script
├── run_bridge.sh                 # Launcher script (loads .env & venv)
├── matrix_antigravity_bridge.py  # Core bridge implementation
├── .env.example                  # Template configuration file
├── .env                          # Local credentials (ignored by git)
├── matrix-env/                   # Python virtual environment (ignored by git)
├── store/                        # E2EE crypto key store (ignored by git)
└── uploads/                      # Temporary decrypted media (ignored by git)
```
