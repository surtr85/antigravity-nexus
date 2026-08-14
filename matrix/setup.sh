#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
echo "🚀 Setting up Antigravity Matrix Bridge in: $DIR"

# 1. Check for Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 is not installed."
    exit 1
fi

# 2. Check for agy CLI
if ! command -v agy &> /dev/null && [ ! -f "$HOME/.local/bin/agy" ]; then
    echo "⚠️ Warning: 'agy' CLI not found in PATH or ~/.local/bin/agy."
    echo "Make sure Google Antigravity is installed and authenticated."
fi

# 3. Create virtual environment if not exists
if [ ! -d "$DIR/matrix-env" ]; then
    echo "📦 Creating Python virtual environment (matrix-env)..."
    python3 -m venv "$DIR/matrix-env"
fi

# 4. Install dependencies
echo "📥 Installing dependencies from requirements.txt..."
"$DIR/matrix-env/bin/pip" install --upgrade pip
"$DIR/matrix-env/bin/pip" install -r "$DIR/requirements.txt" --prefer-binary

# 5. Ensure runner is executable
chmod +x "$DIR/run_bridge.sh"

# 6. Check .env configuration
if [ ! -f "$DIR/.env" ]; then
    echo "⚙️ Creating .env configuration file from template..."
    cp "$DIR/.env.example" "$DIR/.env"
    echo "⚠️ Please edit $DIR/.env with your Matrix homeserver and bot credentials before starting."
fi

# 7. Configure systemd user service
echo "⚙️ Configuring systemd user service..."
mkdir -p "$HOME/.config/systemd/user"
cat << EOF > "$HOME/.config/systemd/user/antigravity-matrix.service"
[Unit]
Description=Antigravity Matrix Chat Bridge
After=network.target

[Service]
Type=simple
WorkingDirectory=$DIR
ExecStart=$DIR/run_bridge.sh
Restart=always
RestartSec=5s

[Install]
WantedBy=default.target
EOF

# 8. Reload and restart service
systemctl --user daemon-reload
systemctl --user enable antigravity-matrix.service
systemctl --user restart antigravity-matrix.service

echo ""
echo "✅ Antigravity Matrix Bridge is installed and running!"
echo "Status: systemctl --user status antigravity-matrix.service"
echo "Logs:   journalctl --user -u antigravity-matrix.service -f"
