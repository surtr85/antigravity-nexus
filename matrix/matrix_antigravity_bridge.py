import os
import sys
import json
import time
import glob
import shutil
import asyncio
import logging
import httpx
import markdown
import nio
from nio.crypto.attachments import decrypt_attachment
import simplematrixbotlib as botlib
from dotenv import load_dotenv

# Base directory of the matrix bridge script
BRIDGE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load environment variables from .env file if present
load_dotenv(os.path.join(BRIDGE_DIR, ".env"))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

# Configuration from Environment Variables (Zero hardcoded secrets)
HOMESERVER = os.environ.get("MATRIX_HOMESERVER", "")
USERNAME = os.environ.get("MATRIX_USERNAME", "")
PASSWORD = os.environ.get("MATRIX_PASSWORD", "")
RECOVERY_KEY = os.environ.get("MATRIX_RECOVERY_KEY", "").strip()

# Access Control: Authorized Matrix User IDs (comma-separated, e.g. @amadeus:matrix.surtr.ir)
ALLOWED_USERS_RAW = os.environ.get("MATRIX_ALLOWED_USERS", "")
ALLOWED_USERS = set(u.strip() for u in ALLOWED_USERS_RAW.split(",") if u.strip())

def is_user_allowed(user_id: str) -> bool:
    """Checks if a user is authorized to interact with Antigravity."""
    if not user_id:
        return False
    if not ALLOWED_USERS or "*" in ALLOWED_USERS:
        return True
    return user_id in ALLOWED_USERS

if ALLOWED_USERS:
    logging.info(f"🔒 Access Control Active: Only authorized users ({len(ALLOWED_USERS)}) can interact: {', '.join(ALLOWED_USERS)}")
else:
    logging.warning("⚠️ Access Control Warning: MATRIX_ALLOWED_USERS is empty. All users can interact.")

# Fallbacks for runtime paths
def find_agy_bin() -> str:
    """Finds the path to the Antigravity 'agy' CLI binary."""
    if env_bin := os.environ.get("AGY_BIN"):
        if os.path.isfile(env_bin) and os.access(env_bin, os.X_OK):
            return env_bin
    if which_bin := shutil.which("agy"):
        return which_bin
    home_bin = os.path.expanduser("~/.local/bin/agy")
    if os.path.isfile(home_bin) and os.access(home_bin, os.X_OK):
        return home_bin
    return "agy"

def find_default_workspace() -> str:
    """Determines the default workspace root directory."""
    if env_ws := os.environ.get("DEFAULT_WORKSPACE"):
        if os.path.isdir(env_ws):
            return os.path.abspath(env_ws)
    parent_dir = os.path.abspath(os.path.join(BRIDGE_DIR, ".."))
    if os.path.isdir(parent_dir):
        return parent_dir
    return os.getcwd()

AGY_BIN = find_agy_bin()
DEFAULT_WORKSPACE = find_default_workspace()
UPLOADS_DIR = os.environ.get("MATRIX_UPLOADS_DIR", os.path.join(BRIDGE_DIR, "uploads"))
STORE_DIR = os.environ.get("MATRIX_STORE_DIR", os.path.join(BRIDGE_DIR, "store"))

os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(STORE_DIR, exist_ok=True)

# Validation of essential credentials
if not HOMESERVER or not USERNAME or not PASSWORD:
    logging.error("❌ Missing Matrix credentials! Please configure MATRIX_HOMESERVER, MATRIX_USERNAME, and MATRIX_PASSWORD in your .env file.")
    sys.exit(1)

# Configure bot with End-to-End Encryption (E2EE) support
bot_config = botlib.Config()
bot_config.encryption_enabled = True
bot_config.ignore_unverified_devices = True
bot_config.join_on_invite = True
bot_config.emoji_verify = True
bot_config.store_path = STORE_DIR

creds = botlib.Creds(HOMESERVER, USERNAME, PASSWORD)
bot = botlib.Bot(creds, bot_config)

# Room states
room_conversations = {}   # room_id -> conversation_id
room_models = {}          # room_id -> model_name
room_dirs = {}            # room_id -> working directory path
room_system_prompts = {}  # room_id -> system instruction string
room_tools_enabled = {}   # room_id -> bool
room_pending_images = {}  # room_id -> {"path": str, "timestamp": float}
room_recent_texts = {}    # room_id -> {"text": str, "timestamp": float}
room_running_procs = {}   # room_id -> asyncio subprocess
room_locks = {}           # room_id -> asyncio.Lock()

AVAILABLE_MODELS = [
    "gemini-3.7-flash-high", "gemini-3.7-flash-medium", "gemini-3.7-flash-low",
    "gemini-3.6-flash-high", "gemini-3.6-flash-medium", "gemini-3.6-flash-low",
    "gemini-3.5-flash-high", "gemini-3.5-flash-medium", "gemini-3.5-flash-low",
    "gemini-3.1-pro-high", "gemini-3.1-pro-low",
    "claude-sonnet-4-6", "claude-opus-4-6-thinking", "gpt-oss-120b-medium"
]

def list_skills() -> str:
    """Scans for available Antigravity skills across standard directories."""
    skills = []
    skill_dirs = [
        os.path.expanduser("~/.gemini/antigravity/builtin/skills/*"),
        os.path.expanduser("~/.gemini/config/skills/*"),
        os.path.join(DEFAULT_WORKSPACE, ".agents/skills/*")
    ]
    for pattern in skill_dirs:
        for s_dir in glob.glob(pattern):
            if os.path.isdir(s_dir):
                s_name = os.path.basename(s_dir)
                skills.append(s_name)

    skills = sorted(list(set(skills)))
    if not skills:
        return "🧠 No skills currently installed."
    
    formatted = "\n".join([f"- `{s}`" for s in skills])
    return f"🧠 **Installed Antigravity Skills** ({len(skills)}):\n{formatted}"

def list_mcp() -> str:
    """Scans for available MCP servers and tools across standard directories."""
    mcp_dirs = [
        os.path.expanduser("~/.gemini/antigravity/mcp/*"),
        os.path.join(DEFAULT_WORKSPACE, "mcp-servers/*")
    ]
    servers = {}
    for pattern in mcp_dirs:
        for s_dir in glob.glob(pattern):
            if os.path.isdir(s_dir):
                s_name = os.path.basename(s_dir)
                tools = []
                for json_file in glob.glob(os.path.join(s_dir, "*.json")):
                    tool_name = os.path.splitext(os.path.basename(json_file))[0]
                    tools.append(tool_name)
                servers[s_name] = sorted(tools)

    if not servers:
        return "🔌 No MCP servers configured."

    out = [f"🔌 **Configured MCP Servers** ({len(servers)}):\n"]
    for s_name, tools in sorted(servers.items()):
        out.append(f"• **`{s_name}`**")
        if tools:
            out.append("  Tools: " + ", ".join([f"`{t}`" for t in tools]))
        else:
            out.append("  Tools: (active)")
    return "\n".join(out)

def render_markdown_to_html(md_text: str) -> str:
    """Converts Markdown to clean Matrix-compatible HTML with tables support."""
    return markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "codehilite", "sane_lists"]
    )

async def send_formatted_message(client, room_id: str, md_text: str):
    """Sends a rich HTML formatted message to Matrix."""
    try:
        html_text = render_markdown_to_html(md_text)
        content = {
            "msgtype": "m.text",
            "body": md_text,
            "format": "org.matrix.custom.html",
            "formatted_body": html_text
        }
        await client.room_send(
            room_id=room_id,
            message_type="m.room.message",
            content=content,
            ignore_unverified_devices=True
        )
    except Exception as e:
        logging.error(f"Error sending formatted message: {e}")
        try:
            await bot.api.send_markdown_message(room_id, md_text)
        except Exception:
            await bot.api.send_text_message(room_id, md_text)

def format_progress_bar(pct: float, length: int = 20) -> str:
    filled = int(round(pct * length))
    bar = "█" * filled + "░" * (length - filled)
    return f"[{bar}] {pct * 100:.1f}%"

async def get_usage_quota(room_id: str = None) -> str:
    """Queries agy /usage and formats quota visual progress bars."""
    res = await run_agy(room_id, ["-p", "/usage"])
    cmd_data = res.get("command", {}).get("data", {})
    groups = cmd_data.get("groups", [])
    
    if not groups:
        resp = res.get("response", "").strip()
        return f"📊 **Models & Quota**\n\n```\n{resp}\n```"

    out = ["📊 **Antigravity Models & Quota**\n"]
    for g in groups:
        g_name = g.get("name", "Group")
        g_desc = g.get("description", "")
        out.append(f"### {g_name}")
        if g_desc:
            out.append(f"_{g_desc}_\n")
        
        for b in g.get("buckets", []):
            b_name = b.get("name", "Limit")
            rem_frac = b.get("remaining_fraction", 1.0)
            reset_t = b.get("reset_time", "N/A")
            bar = format_progress_bar(rem_frac)
            out.append(f"- **{b_name}**:\n  `{bar}`\n  Reset time: `{reset_t}`")
        out.append("")

    return "\n".join(out)

async def run_agy(room_id: str, args: list) -> dict:
    """Executes agy CLI command and parses JSON response."""
    cwd = room_dirs.get(room_id, DEFAULT_WORKSPACE) if room_id else DEFAULT_WORKSPACE
    cmd = [AGY_BIN] + args + ["--output-format", "json"]
    
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=cwd
    )
    if room_id:
        room_running_procs[room_id] = proc

    try:
        stdout, stderr = await proc.communicate()
    finally:
        if room_id:
            room_running_procs.pop(room_id, None)

    out_str = stdout.decode().strip()
    err_str = stderr.decode().strip()
    
    if proc.returncode != 0:
        if proc.returncode in [-9, -15, 137, 143]:  # SIGKILL or SIGTERM
            return {"response": "🛑 Task was cancelled.", "status": "CANCELLED"}
        raise RuntimeError(err_str or f"agy command failed with exit code {proc.returncode}")
        
    try:
        return json.loads(out_str)
    except json.JSONDecodeError:
        return {"response": out_str, "status": "SUCCESS"}

async def send_reaction(client, room_id: str, event_id: str, emoji: str):
    """Sends a reaction emoji to a specific event."""
    try:
        content = {
            "m.relates_to": {
                "rel_type": "m.annotation",
                "event_id": event_id,
                "key": emoji
            }
        }
        await client.room_send(
            room_id=room_id,
            message_type="m.reaction",
            content=content,
            ignore_unverified_devices=True
        )
    except Exception as e:
        logging.warning(f"Could not send reaction: {e}")

async def handle_command(room_id: str, command: str, args: list) -> str:
    """Handles custom /slash commands."""
    cmd = command.lower()

    if cmd in ["/new", "/reset"]:
        room_conversations.pop(room_id, None)
        room_pending_images.pop(room_id, None)
        room_recent_texts.pop(room_id, None)
        return "🔄 Started a new Antigravity chat session for this room!"

    elif cmd in ["/stop", "/cancel", "/interrupt"]:
        if room_id in room_running_procs and room_running_procs[room_id]:
            proc = room_running_procs[room_id]
            try:
                proc.kill()
            except Exception:
                pass
            room_running_procs.pop(room_id, None)
            return "🛑 **Interrupted!** The currently running task has been stopped."
        else:
            return "ℹ️ No task is currently running in this room."

    elif cmd in ["/dir", "/cd", "/pwd", "/workspace"]:
        if not args:
            cur_dir = room_dirs.get(room_id, DEFAULT_WORKSPACE)
            return f"📂 **Current Working Directory**:\n`{cur_dir}`\n\nTo change directory, type: `/dir <path>`"
        target_dir = os.path.expanduser(" ".join(args).strip())
        if not os.path.isdir(target_dir):
            return f"❌ Directory not found: `{target_dir}`"
        abs_path = os.path.abspath(target_dir)
        room_dirs[room_id] = abs_path
        return f"✅ Changed working directory for this room to:\n`{abs_path}`\n*(Conversation memory preserved)*"

    elif cmd in ["/system", "/persona"]:
        if not args:
            cur_sys = room_system_prompts.get(room_id, "Default Antigravity Persona")
            return f"🎭 **Current System Instruction**:\n`{cur_sys}`\n\nTo update, type: `/system <your custom instructions>`"
        sys_prompt = " ".join(args).strip()
        room_system_prompts[room_id] = sys_prompt
        return f"✅ Updated system instruction for this room to:\n`{sys_prompt}`"

    elif cmd in ["/tools", "/tool"]:
        if not args:
            status = "ON (Allowed)" if room_tools_enabled.get(room_id) else "OFF (Read-Only)"
            return f"🛠 **Workspace Tools**: `{status}`\n\nTo toggle: `/tools on` or `/tools off`"
        val = args[0].lower()
        if val in ["on", "enable", "true", "1"]:
            room_tools_enabled[room_id] = True
            return "🛠 **Workspace Tools Enabled**! Antigravity can now execute workspace commands when requested."
        else:
            room_tools_enabled[room_id] = False
            return "🔒 **Workspace Tools Disabled**! Running in read-only chat mode."

    elif cmd in ["/usage", "/stats", "/quota"]:
        cid = room_conversations.get(room_id, "None (Not started)")
        cur_m = room_models.get(room_id, "Default")
        cur_d = room_dirs.get(room_id, DEFAULT_WORKSPACE)
        sys_p = room_system_prompts.get(room_id, "Default")
        tools_s = "ON" if room_tools_enabled.get(room_id) else "OFF"
        quota_str = await get_usage_quota(room_id)
        return (
            f"💬 **Room Session**: `{cid}`\n"
            f"🤖 **Room Model**: `{cur_m}`\n"
            f"📂 **Working Directory**: `{cur_d}`\n"
            f"🛠 **Tools Enabled**: `{tools_s}`\n"
            f"🎭 **System Persona**: `{sys_p}`\n\n"
            f"{quota_str}"
        )

    elif cmd in ["/model", "/models"]:
        if not args:
            cur_model = room_models.get(room_id, "Default (Gemini 3.6 Flash)")
            models_list = "\n".join([f"- `{m}`" for m in AVAILABLE_MODELS])
            return (
                f"🤖 **Current Model**: `{cur_model}`\n\n"
                f"**Available Models**:\n{models_list}\n\n"
                f"To change model, type: `/model <model-name>`"
            )
        target_model = args[0].strip()
        matched = next((m for m in AVAILABLE_MODELS if target_model in m), target_model)
        room_models[room_id] = matched
        return f"✅ Changed model for this room to `{matched}`."

    elif cmd in ["/skills", "/skill"]:
        return list_skills()

    elif cmd in ["/mcp", "/mcps"]:
        return list_mcp()

    elif cmd in ["/help", "/commands"]:
        return (
            "⚡️ **Antigravity Matrix Commands Reference** ⚡️\n\n"
            "Here is the complete list of slash commands available in Matrix chat:\n\n"
            "• **`/help`** (or `/commands`)\n"
            "  └ Show this detailed help manual.\n\n"
            "• **`/stop`** (or `/cancel` / `/interrupt`)\n"
            "  └ Stop and interrupt the currently running agent task immediately.\n\n"
            "• **`/dir`** [ *path* ] (or `/cd` / `/pwd`)\n"
            "  └ View or change the active working directory for this room. Example: `/dir /path/to/project`\n\n"
            "• **`/new`** (or `/reset` / `/clear`)\n"
            "  └ Reset and start a fresh conversation session for this room.\n\n"
            "• **`/model`** [ *model-name* ] (or `/models`)\n"
            "  └ View active model or switch models. Example: `/model claude-sonnet-4-6` or `/model gemini-3.7-flash-high`.\n\n"
            "• **`/system`** [ *instructions* ] (or `/persona`)\n"
            "  └ View or set custom system instructions for this room. Example: `/system You are a Senior DevOps Engineer.`\n\n"
            "• **`/tools`** [ *on | off* ]\n"
            "  └ Toggle whether Antigravity can run workspace bash commands and edit code from Matrix chat.\n\n"
            "• **`/usage`** (or `/quota` / `/stats`)\n"
            "  └ Display current room session info, active model, and visual progress bars for account quota limits.\n\n"
            "• **`/skills`**\n"
            "  └ List all installed Antigravity skills and custom automation workflows.\n\n"
            "• **`/mcp`**\n"
            "  └ List active Model Context Protocol (MCP) servers and their available tools.\n\n"
            "💡 *Tip: You can also upload images directly to Matrix chat for visual analysis!*"
        )
    else:
        return f"❓ Unknown slash command `{command}`. Type `/help` for available commands."

async def on_invite_callback(room, event):
    """Automatically join room when invited by an authorized user."""
    client = bot.api.async_client
    if event.state_key == client.user_id:
        sender = getattr(event, "sender", None)
        if not is_user_allowed(sender):
            logging.warning(f"🚫 Rejected invitation from unauthorized user '{sender}' to room: {room.room_id}")
            return
        logging.info(f"Accepted invitation from authorized user '{sender}' to room: {room.room_id}")
        await client.join(room.room_id)

async def download_matrix_media(client, event) -> str:
    """Downloads & decrypts Matrix media from homeserver."""
    mxc_url = None
    enc_info = None

    # Check content dictionary in source event
    content = getattr(event, "source", {}).get("content", {})
    if "file" in content and isinstance(content["file"], dict):
        f = content["file"]
        mxc_url = f.get("url")
        key_data = f.get("key", {})
        enc_info = {
            "key": key_data.get("k") if isinstance(key_data, dict) else str(key_data),
            "hash": f.get("hashes", {}).get("sha256") if isinstance(f.get("hashes"), dict) else None,
            "iv": f.get("iv")
        }
    elif hasattr(event, "url") and event.url:
        mxc_url = event.url
        if hasattr(event, "key") and hasattr(event, "hashes") and hasattr(event, "iv"):
            key_data = getattr(event, "key", {})
            hashes_data = getattr(event, "hashes", {})
            enc_info = {
                "key": key_data.get("k") if isinstance(key_data, dict) else str(key_data),
                "hash": hashes_data.get("sha256") if isinstance(hashes_data, dict) else None,
                "iv": getattr(event, "iv", None)
            }

    if not mxc_url or not mxc_url.startswith("mxc://"):
        logging.warning(f"Could not find valid MXC URL in event: {event}")
        return None

    mxc_body = mxc_url[6:]
    server_name, media_id = mxc_body.split("/", 1)
    token = getattr(client, "access_token", None)
    
    urls = [
        f"{HOMESERVER}/_matrix/client/v1/media/download/{server_name}/{media_id}",
        f"{HOMESERVER}/_matrix/media/v3/download/{server_name}/{media_id}"
    ]
    
    raw_bytes = None
    async with httpx.AsyncClient() as http:
        for url in urls:
            headers = {"Authorization": f"Bearer {token}"} if token else {}
            r = await http.get(url, headers=headers, timeout=30.0)
            if r.status_code == 200 and r.content:
                raw_bytes = r.content
                break
                
    if not raw_bytes:
        logging.error(f"Could not download media bytes from {mxc_url}")
        return None

    # If this is an encrypted attachment, decrypt with nio attachment decryptor
    if enc_info and enc_info.get("key") and enc_info.get("hash") and enc_info.get("iv"):
        try:
            raw_bytes = decrypt_attachment(
                raw_bytes,
                enc_info["key"],
                enc_info["hash"],
                enc_info["iv"]
            )
            logging.info(f"Successfully decrypted E2EE Matrix image ({len(raw_bytes)} bytes)!")
        except Exception as e:
            logging.error(f"Failed to decrypt E2EE attachment: {e}", exc_info=True)
            return None

    file_path = os.path.join(UPLOADS_DIR, f"img_{media_id}.png")
    with open(file_path, "wb") as f:
        f.write(raw_bytes)
    logging.info(f"Saved media image to: {file_path}")
    return file_path

async def process_user_prompt(room_id: str, prompt_text: str, event_id: str = None, attached_image: str = None):
    """Executes prompt via agy with full conversation and image attachment context."""
    client = bot.api.async_client
    if room_id not in room_locks:
        room_locks[room_id] = asyncio.Lock()

    # Fast-path for stop/cancel command (don't wait on room_locks)
    if prompt_text.strip().lower() in ["/stop", "/cancel", "/interrupt"]:
        reply = await handle_command(room_id, "/stop", [])
        await send_formatted_message(client, room_id, reply)
        return

    async with room_locks[room_id]:
        # Handle slash commands
        if prompt_text.startswith("/"):
            parts = prompt_text.split()
            command = parts[0]
            cmd_args = parts[1:]
            
            internal_cmds = [
                "/new", "/reset", "/usage", "/stats", "/quota", "/model", "/models",
                "/dir", "/cd", "/pwd", "/workspace", "/stop", "/cancel", "/interrupt",
                "/system", "/persona", "/tools", "/tool", "/skills", "/skill",
                "/mcp", "/mcps", "/help", "/commands"
            ]
            if command in internal_cmds:
                reply = await handle_command(room_id, command, cmd_args)
                await send_formatted_message(client, room_id, reply)
                return

        # Start typing indicator & send reaction
        await client.room_typing(room_id, typing_state=True, timeout=30000)
        if event_id:
            asyncio.create_task(send_reaction(client, room_id, event_id, "⚙️"))

        try:
            agy_args = []
            
            # Working directory flag
            cwd = room_dirs.get(room_id, DEFAULT_WORKSPACE)
            agy_args.extend(["--add-dir", cwd])

            # Model flag
            if room_id_model := room_models.get(room_id):
                agy_args.extend(["--model", room_id_model])

            # Conversation state flag
            if conv_id := room_conversations.get(room_id):
                agy_args.extend(["--conversation", conv_id])

            # Tools permission flag
            if room_tools_enabled.get(room_id):
                agy_args.append("--dangerously-skip-permissions")

            # Construct full prompt with active working directory, system prompt, and image reference
            full_prompt = prompt_text
            if attached_image and os.path.exists(attached_image) and os.path.getsize(attached_image) > 0:
                full_prompt = (
                    f"Please inspect and analyze the attached user image located at file://{attached_image} "
                    f"to answer the user.\n\nUser request: {prompt_text}"
                )
                # Clear pending image once used
                room_pending_images.pop(room_id, None)

            # Inform the model of the active directory for this prompt
            full_prompt = f"[Active Working Directory: {cwd}]\n\n{full_prompt}"

            if sys_prompt := room_system_prompts.get(room_id):
                full_prompt = f"[System Instruction: {sys_prompt}]\n\n{full_prompt}"

            agy_args.extend(["-p", full_prompt])

            res = await run_agy(room_id, agy_args)

            # Update saved conversation ID
            if cid := res.get("conversation_id"):
                room_conversations[room_id] = cid

            reply_text = res.get("response", "").strip()

            if reply_text:
                await send_formatted_message(client, room_id, reply_text)
            else:
                await send_formatted_message(client, room_id, "*(Antigravity returned an empty response)*")

            if event_id:
                asyncio.create_task(send_reaction(client, room_id, event_id, "✅"))

        except Exception as e:
            logging.error(f"Error handling message for room {room_id}: {e}", exc_info=True)
            await send_formatted_message(client, room_id, f"⚠️ Antigravity Error: {str(e)}")

        finally:
            await client.room_typing(room_id, typing_state=False)

async def image_handler(room, event):
    """Handles image and encrypted image upload events."""
    client = bot.api.async_client
    sender = getattr(event, "sender", None)
    if sender == client.user_id or not is_user_allowed(sender):
        return

    logging.info(f"Received image event from {event.sender} in {room.room_id} (type: {type(event).__name__})")
    img_path = await download_matrix_media(client, event)
    if not img_path:
        return

    room_pending_images[room.room_id] = {
        "path": img_path,
        "timestamp": time.time()
    }

    # Check caption or previous recent text message
    caption = getattr(event, "body", "").strip()
    is_plain_filename = caption.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")) or not caption

    recent_text = room_recent_texts.get(room.room_id)
    if not is_plain_filename:
        prompt_to_use = caption
    elif recent_text and (time.time() - recent_text["timestamp"] < 45):
        prompt_to_use = recent_text["text"]
    else:
        prompt_to_use = "Please inspect, analyze, and describe who or what is in this uploaded image in detail."

    await process_user_prompt(
        room_id=room.room_id,
        prompt_text=prompt_to_use,
        event_id=event.event_id,
        attached_image=img_path
    )

@bot.listener.on_message_event
async def message_handler(room, message):
    """Handles regular text message events."""
    match = botlib.MessageMatch(room, message, bot, "")
    
    # Do not process messages sent by the bot itself
    if not match.is_not_from_this_bot():
        return

    sender = getattr(message, "sender", None)
    if not is_user_allowed(sender):
        logging.warning(f"🚫 Ignored message from unauthorized user '{sender}' in {room.room_id}")
        return

    text = message.body.strip() if hasattr(message, "body") and message.body else ""
    if not text:
        return

    # Track recent text message for prompt linking
    room_recent_texts[room.room_id] = {
        "text": text,
        "timestamp": time.time()
    }

    # Check if there is an image uploaded within the last 120 seconds
    attached_img = None
    if room.room_id in room_pending_images:
        entry = room_pending_images[room.room_id]
        if time.time() - entry["timestamp"] < 120 and os.path.exists(entry["path"]):
            attached_img = entry["path"]

    logging.info(f"Message from {message.sender} in {room.room_id}: {text[:60]}")

    await process_user_prompt(
        room_id=room.room_id,
        prompt_text=text,
        event_id=getattr(message, "event_id", None),
        attached_image=attached_img
    )

async def to_device_callback(event):
    """Handles SAS Emoji and Cross-Signing Key Verification from authorized users."""
    client = bot.api.async_client
    sender = getattr(event, "sender", None)
    
    # Reject verification attempts from unauthorized users
    if not is_user_allowed(sender):
        logging.warning(f"🚫 Rejected key verification request from unauthorized user: '{sender}'")
        if hasattr(event, "transaction_id"):
            await client.cancel_key_verification(event.transaction_id, reject=True)
        return

    if isinstance(event, nio.KeyVerificationStart):
        if "m.sas.v1" not in event.methods:
            logging.warning(f"Unsupported verification method: {event.methods}")
            return
        logging.info(f"🔑 Initiated SAS Key Verification with authorized user '{sender}' (txn: {event.transaction_id})")
        res = await client.accept_key_verification(event.transaction_id)
        if isinstance(res, nio.ToDeviceError):
            logging.error(f"Failed to accept key verification: {res}")
            return
        sas = client.key_verifications.get(event.transaction_id)
        if sas:
            await client.to_device(sas.share_key())

    elif isinstance(event, nio.KeyVerificationKey):
        sas = client.key_verifications.get(event.transaction_id)
        if not sas:
            return
        emojis = sas.get_emoji()
        emoji_str = "  ".join([f"{e[0]} {e[1]}" for e in emojis])
        logging.info(f"🔑 SAS Emoji Verification with {sender}:\n👉 Emojis: {emoji_str}")
        logging.info("✅ Auto-confirming SAS verification for authorized user...")
        await client.confirm_key_verification(event.transaction_id)
        await client.to_device(sas.get_mac())

    elif isinstance(event, nio.KeyVerificationMac):
        sas = client.key_verifications.get(event.transaction_id)
        if not sas:
            return
        try:
            sas.verify_mac(event)
            logging.info(f"🎉 SUCCESS: Device for user '{sender}' is now FULLY VERIFIED (Shield 🛡️ / Green Tick ✅)!")
        except Exception as e:
            logging.error(f"MAC verification failed: {e}")

    elif isinstance(event, nio.KeyVerificationCancel):
        logging.info(f"Verification canceled by {sender}: {event.reason} (code: {event.code})")

# Register SAS to-device callbacks on connection setup
orig_setup_callbacks = botlib.Callbacks.setup_callbacks

async def custom_setup_callbacks(self):
    await orig_setup_callbacks(self)
    client = self.async_client
    if not getattr(client, "_sas_callback_registered", False):
        client._sas_callback_registered = True
        client.add_to_device_callback(
            to_device_callback,
            (
                nio.KeyVerificationStart,
                nio.KeyVerificationKey,
                nio.KeyVerificationMac,
                nio.KeyVerificationCancel
            )
        )
        logging.info("🔐 SAS Emoji Verification & Device Trust callbacks registered.")
        
        # Check for recovery key / key backup
        if RECOVERY_KEY:
            logging.info("🔐 Matrix Recovery Key loaded for Secure Secret Storage (SSSS).")
            key_file = os.path.join(STORE_DIR, "megolm_keys.txt")
            if os.path.isfile(key_file):
                try:
                    await client.import_keys(key_file, RECOVERY_KEY)
                    logging.info("✅ Successfully imported Megolm room keys using Recovery Key.")
                except Exception as e:
                    logging.warning(f"Could not import key file with recovery key: {e}")

botlib.Callbacks.setup_callbacks = custom_setup_callbacks

def main():
    logging.info(f"Starting Matrix-to-Antigravity bridge for user '@{USERNAME}' on {HOMESERVER} (E2EE Enabled)...")
    
    # Register event listeners directly into bot listener registry
    bot.listener._registry.append([on_invite_callback, nio.InviteMemberEvent])
    bot.listener._registry.append([image_handler, nio.RoomMessageImage])
    bot.listener._registry.append([image_handler, nio.RoomEncryptedImage])
    bot.listener._registry.append([image_handler, nio.RoomEncryptedFile])
    bot.listener._registry.append([image_handler, nio.RoomEncryptedMedia])
    
    bot.run()

if __name__ == "__main__":
    main()
