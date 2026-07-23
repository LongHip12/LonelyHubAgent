# LonelyHub AI Agent

Web server for the Lonely AI Agent — a hybrid Chatbot + AI Agent built into Lonely Hub.

**Live URL:** https://lonelyhubaiagent.onrender.com

## Features

- 🤖 **AI Agent + Chatbot** — switches automatically based on context
- ▶ **Code Execution** — Python, JavaScript, C++, C, Bash (runs on server)
- 💭 **Thinking Display** — shows AI reasoning in collapsible panels
- ⚡ **Action Blocks** — agent actions displayed like Replit Agent (JSON → output)
- 🔗 **WebSocket** — keeps connection alive; auto-deletes project data on disconnect
- 📁 **File Operations** — read, write, delete, copy, rename files in project workspace
- ⎇ **Git Integration** — init, clone, add, commit, push, pull, branch, status, etc.
- 🌊 **Stream Mode** — typewriter effect toggle
- 🎨 **7 AI Models** — Lonely AI, Quick Chat, Coder, Reasoner, Balanced, Scholar, Owl

## Setup

```bash
npm install
node server.js
```

Or with PM2:
```bash
pm2 start server.js --name lonelyhub-ai
```

## Environment

Copy `.env.example` → `.env` and adjust if needed.

```
PORT=3000
DATA_DIR=./data
```

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Chat with AI |
| GET | `/api/chat/models` | List models |
| POST | `/api/exec` | Run code |
| POST | `/api/git/:projectId/:action` | Git operations |
| GET | `/api/files/:projectId/tree` | File tree |
| GET | `/api/files/:projectId/read?path=...` | Read file |
| POST | `/api/files/:projectId/write` | Write file |
| DELETE | `/api/files/:projectId/delete?path=...` | Delete file |
| WS | `/ws?session=...` | WebSocket keepalive |

## Agent Action Format

The AI uses JSON blocks to trigger actions:

```json
{"action": "run code", "lang": "python", "source": "print('Hello')"}
{"action": "git", "projectId": "myproject", "command": "status"}
{"action": "read file", "projectId": "myproject", "path": "main.py"}
{"action": "write file", "projectId": "myproject", "path": "hello.py", "content": "..."}
{"action": "create project", "projectId": "myproject"}
```

## Files

- `server.js` — Express + WebSocket server
- `public/` — Frontend (HTML/CSS/JS)
- `src/routes/` — API route handlers
- `src/ws/` — WebSocket session manager
- `src/sandbox/` — Code execution sandbox
- `training.txt` — AI training content
- `LonelyAI_v7.lua` — Roblox Lua client
