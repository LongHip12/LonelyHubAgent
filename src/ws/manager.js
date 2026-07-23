const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || './data';
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');

// Map: sessionId -> { ws, projectIds: [] }
const sessions = new Map();

function deleteFolderRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach(file => {
      const cur = path.join(dirPath, file);
      if (fs.lstatSync(cur).isDirectory()) deleteFolderRecursive(cur);
      else fs.unlinkSync(cur);
    });
    fs.rmdirSync(dirPath);
  }
}

function cleanupSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  for (const pid of session.projectIds) {
    const pdir = path.join(PROJECTS_DIR, pid);
    try { deleteFolderRecursive(pdir); } catch (_) {}
  }
  sessions.delete(sessionId);
  console.log(`[WS] Session ${sessionId} cleaned up (${session.projectIds.length} projects removed)`);
}

function registerProject(sessionId, projectId) {
  const session = sessions.get(sessionId);
  if (session && !session.projectIds.includes(projectId)) {
    session.projectIds.push(projectId);
  }
}

function initWS(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url.replace('/ws?', ''));
    const sessionId = params.get('session') || Math.random().toString(36).slice(2);

    sessions.set(sessionId, { ws, projectIds: [] });
    console.log(`[WS] Session connected: ${sessionId}`);

    ws.send(JSON.stringify({ type: 'connected', sessionId }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'register_project') {
          registerProject(sessionId, msg.projectId);
        } else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (_) {}
    });

    ws.on('close', () => {
      console.log(`[WS] Session disconnected: ${sessionId}`);
      cleanupSession(sessionId);
    });

    ws.on('error', () => {
      cleanupSession(sessionId);
    });
  });

  // Heartbeat every 30s
  setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.readyState === ws.OPEN) ws.ping();
    });
  }, 30000);

  return wss;
}

module.exports = { initWS, sessions, registerProject, cleanupSession };
