// ── CONFIG ──
const API = '';  // same origin
const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
const TRAINING_URL = 'https://raw.githubusercontent.com/LongHip12/Lonely-AI/refs/heads/main/Train/LonelyAI-TrainingContent.txt';

// ── STATE ──
let sessionId = localStorage.getItem('lh_session') || null;
let ws = null;
let wsReady = false;
let history = [];
let sysPrompt = null;
let currentModel = localStorage.getItem('lh_model') || 'lonely-ai';
let streamMode = localStorage.getItem('lh_stream') !== 'false';
let chatSessions = JSON.parse(localStorage.getItem('lh_sessions') || '[]');
let activeChatId = null;
let busy = false;

// ── DOM ──
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const modelSel = document.getElementById('model-select');
const streamToggle = document.getElementById('stream-toggle');
const wsDot = document.getElementById('ws-dot');
const wsStatusEl = document.getElementById('ws-status');
const chatHistoryEl = document.getElementById('chat-history');
const sidebarEl = document.getElementById('sidebar');

// ── INIT ──
(async function init() {
  streamToggle.checked = streamMode;
  streamToggle.addEventListener('change', () => {
    streamMode = streamToggle.checked;
    localStorage.setItem('lh_stream', streamMode);
  });

  document.getElementById('sidebar-toggle').onclick = () => sidebarEl.classList.toggle('collapsed');
  document.getElementById('new-chat-btn').onclick = newChat;
  document.getElementById('clear-btn').onclick = clearChat;

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 180) + 'px';
  });
  sendBtn.onclick = sendMessage;

  await loadModels();
  await loadSysPrompt();
  connectWS();
  renderHistory();

  if (chatSessions.length > 0) {
    loadChat(chatSessions[0].id);
  } else {
    newChat();
  }
})();

// ── SYSTEM PROMPT ──
async function loadSysPrompt() {
  try {
    const r = await fetch(TRAINING_URL);
    sysPrompt = await r.text();
  } catch (_) {
    sysPrompt = 'You are Lonely AI — a smart AI assistant and agent for LonelyHub. You can run code, manage files, and help with Roblox scripting. Respond naturally and helpfully.';
  }
}

// ── MODELS ──
async function loadModels() {
  try {
    const r = await fetch(`${API}/api/chat/models`);
    const models = await r.json();
    modelSel.innerHTML = models.map(m =>
      `<option value="${m.id}" ${m.id === currentModel ? 'selected' : ''}>${m.name}</option>`
    ).join('');
    modelSel.onchange = () => {
      currentModel = modelSel.value;
      localStorage.setItem('lh_model', currentModel);
    };
  } catch (_) {}
}

// ── WEBSOCKET ──
function connectWS() {
  const url = sessionId ? `${WS_URL}?session=${sessionId}` : WS_URL;
  ws = new WebSocket(url);

  ws.onopen = () => {};
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'connected') {
        sessionId = msg.sessionId;
        localStorage.setItem('lh_session', sessionId);
        wsReady = true;
        wsDot.className = 'ws-dot connected';
        wsStatusEl.textContent = 'Connected';
      } else if (msg.type === 'pong') { /* ok */ }
    } catch (_) {}
  };
  ws.onclose = () => {
    wsReady = false;
    wsDot.className = 'ws-dot error';
    wsStatusEl.textContent = 'Disconnected';
    setTimeout(connectWS, 3000);
  };
  ws.onerror = () => {
    wsDot.className = 'ws-dot error';
    wsStatusEl.textContent = 'Error';
  };

  // Keepalive ping every 25s
  setInterval(() => {
    if (wsReady && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 25000);
}

// ── CHAT SESSIONS ──
function newChat() {
  const id = 'chat_' + Date.now();
  activeChatId = id;
  history = sysPrompt ? [{ role: 'system', content: sysPrompt }] : [];
  chatSessions.unshift({ id, title: 'New Chat', ts: Date.now() });
  if (chatSessions.length > 30) chatSessions.pop();
  saveChats();
  messagesEl.innerHTML = `
    <div id="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <h2>Lonely AI Agent</h2>
      <p>Ask me anything — or ask me to run code, manage files, use git...</p>
    </div>`;
  renderHistory();
}

function loadChat(id) {
  activeChatId = id;
  const saved = JSON.parse(localStorage.getItem('lh_chat_' + id) || 'null');
  if (saved) {
    history = saved.history || [{ role: 'system', content: sysPrompt }];
    messagesEl.innerHTML = '';
    for (const msg of saved.rendered || []) renderStoredMessage(msg);
  } else {
    history = sysPrompt ? [{ role: 'system', content: sysPrompt }] : [];
    messagesEl.innerHTML = '';
    const empty = document.getElementById('empty-state');
    if (!empty) messagesEl.innerHTML = `<div id="empty-state"><svg width="64" height="64" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><h2>Lonely AI Agent</h2><p>Ask me anything — or ask me to run code, manage files, use git...</p></div>`;
  }
  renderHistory();
}

function saveChats() { localStorage.setItem('lh_sessions', JSON.stringify(chatSessions)); }

function saveChatData(rendered) {
  localStorage.setItem('lh_chat_' + activeChatId, JSON.stringify({ history, rendered }));
}

function clearChat() {
  if (activeChatId) {
    localStorage.removeItem('lh_chat_' + activeChatId);
    chatSessions = chatSessions.filter(s => s.id !== activeChatId);
    saveChats();
  }
  newChat();
}

function renderHistory() {
  chatHistoryEl.innerHTML = chatSessions.map(s =>
    `<div class="history-item ${s.id === activeChatId ? 'active' : ''}" onclick="loadChat('${s.id}')">${escHtml(s.title)}</div>`
  ).join('');
}

// ── SEND MESSAGE ──
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || busy) return;
  busy = true;
  sendBtn.disabled = true;
  inputEl.value = '';
  inputEl.style.height = 'auto';

  removeEmpty();
  appendUserMsg(text);
  history.push({ role: 'user', content: text });

  // Update session title
  if (chatSessions.find(s => s.id === activeChatId)?.title === 'New Chat') {
    const c = chatSessions.find(s => s.id === activeChatId);
    if (c) c.title = text.slice(0, 40);
    saveChats(); renderHistory();
  }

  const workingEl = appendWorking();

  try {
    const aiResp = await callAI();
    workingEl.remove();
    await processAIResponse(aiResp);
  } catch (err) {
    workingEl.remove();
    appendAIMsg(`[Error] ${err.message}`);
  }

  busy = false;
  sendBtn.disabled = false;
  inputEl.focus();
}

// ── AI CALL ──
async function callAI() {
  const r = await fetch(`${API}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId: currentModel, messages: history, stream: false })
  });
  const data = await r.json();
  if (!data.ok) throw new Error(data.content || 'AI request failed');
  return data;
}

// ── PROCESS AI RESPONSE ──
// Parses AI content for JSON action blocks and thinking
async function processAIResponse(resp) {
  const { content, thinking, secs, modelName } = resp;

  // Parse action blocks from content
  const actions = [];
  let displayContent = content;

  // Find all JSON action blocks: {"action": ...}
  const jsonRegex = /\{[\s\S]*?"action"\s*:[\s\S]*?\}/g;
  let match;
  const foundBlocks = [];
  while ((match = jsonRegex.exec(content)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      if (obj.action) {
        foundBlocks.push({ raw: match[0], obj, index: match.index });
      }
    } catch (_) {}
  }

  // Remove action blocks from display content
  for (const b of foundBlocks) {
    displayContent = displayContent.replace(b.raw, '').trim();
    actions.push(b.obj);
  }

  history.push({ role: 'assistant', content });

  // If we have actions, show agent panel
  if (actions.length > 0) {
    const panel = createAgentPanel(actions, thinking, displayContent);
    messagesEl.appendChild(panel);
    scrollDown();

    // Execute each action sequentially
    for (const action of actions) {
      await executeAction(action, panel);
    }

    // After all actions, show follow-up bubble if there's display content
    if (displayContent) {
      await appendAIMsgAnimated(displayContent, false);
    }
  } else {
    // Normal response — just show in chat bubble
    // If thinking, show it in a collapsible first
    if (thinking) {
      const thinkPanel = createThinkPanel(thinking, secs);
      messagesEl.appendChild(thinkPanel);
    }
    await appendAIMsgAnimated(displayContent, streamMode);
  }
  scrollDown();
}

// ── AGENT PANEL ──
function createAgentPanel(actions, thinking, preText) {
  const div = document.createElement('div');
  div.className = 'msg-row';

  const panel = document.createElement('div');
  panel.className = 'agent-panel';

  // Header with icon row
  const icons = ['⊕', '<>', '⊕', '<>', '⊕'].slice(0, Math.min(actions.length, 5));
  const header = document.createElement('div');
  header.className = 'agent-actions-header';
  header.innerHTML = `
    <div class="action-icons">${icons.map(i => `<span class="action-icon">${i}</span>`).join('')}</div>
    <span class="action-count">‹ ${actions.length} action${actions.length > 1 ? 's' : ''}</span>
    <svg class="action-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
  `;

  const body = document.createElement('div');
  body.className = 'agent-actions-body';

  // Add thinking if present
  if (thinking) {
    const thinkItem = document.createElement('div');
    thinkItem.className = 'action-item';
    const thinkHeader = document.createElement('div');
    thinkHeader.className = 'action-item-header';
    thinkHeader.innerHTML = `
      <span class="action-item-icon">⊕</span>
      <span class="action-item-label">Thinking...</span>
      <span class="action-item-chevron">▾</span>
    `;
    const thinkBody = document.createElement('div');
    thinkBody.className = 'action-item-body';
    thinkBody.innerHTML = `<div class="think-block">${escHtml(thinking)}</div>`;
    thinkHeader.onclick = () => {
      thinkHeader.classList.toggle('open');
      thinkBody.classList.toggle('open');
    };
    thinkItem.appendChild(thinkHeader);
    thinkItem.appendChild(thinkBody);
    body.appendChild(thinkItem);
  }

  // Add pre-text if any
  if (preText && preText.trim()) {
    const preItem = document.createElement('div');
    preItem.className = 'action-item';
    const preHeader = document.createElement('div');
    preHeader.className = 'action-item-header open';
    preHeader.innerHTML = `
      <span class="action-item-icon">⊕</span>
      <span class="action-item-label">Response</span>
      <span class="action-item-chevron">▾</span>
    `;
    const preBody = document.createElement('div');
    preBody.className = 'action-item-body open';
    preBody.innerHTML = `<div style="color:var(--text);font-size:13px;line-height:1.6;">${renderMarkdown(preText)}</div>`;
    preHeader.onclick = () => {
      preHeader.classList.toggle('open');
      preBody.classList.toggle('open');
    };
    preItem.appendChild(preHeader);
    preItem.appendChild(preBody);
    body.appendChild(preItem);
  }

  // Create action items (placeholders — filled by executeAction)
  panel._actionItems = [];
  for (const action of actions) {
    const item = createActionItem(action);
    body.appendChild(item.el);
    panel._actionItems.push(item);
  }

  // Toggle
  header.onclick = () => {
    header.classList.toggle('open');
    body.classList.toggle('open');
  };
  // Default: open
  header.classList.add('open');
  body.classList.add('open');

  panel.appendChild(header);
  panel.appendChild(body);
  div.appendChild(panel);
  return div;
}

function createThinkPanel(thinking, secs) {
  const div = document.createElement('div');
  div.className = 'msg-row';
  const panel = document.createElement('div');
  panel.className = 'agent-panel';
  const header = document.createElement('div');
  header.className = 'agent-actions-header';
  header.innerHTML = `
    <div class="action-icons"><span class="action-icon">⊕</span></div>
    <span class="action-count">‹ Worked for ${secs}s</span>
    <svg class="action-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
  `;
  const body = document.createElement('div');
  body.className = 'agent-actions-body';
  const item = document.createElement('div');
  item.className = 'action-item';
  const iHeader = document.createElement('div');
  iHeader.className = 'action-item-header';
  iHeader.innerHTML = `<span class="action-item-icon">⊕</span><span class="action-item-label">Thinking</span><span class="action-item-chevron">▾</span>`;
  const iBody = document.createElement('div');
  iBody.className = 'action-item-body';
  iBody.innerHTML = `<div class="think-block">${escHtml(thinking)}</div>`;
  iHeader.onclick = () => { iHeader.classList.toggle('open'); iBody.classList.toggle('open'); };
  item.appendChild(iHeader); item.appendChild(iBody);
  body.appendChild(item);
  header.onclick = () => { header.classList.toggle('open'); body.classList.toggle('open'); };
  panel.appendChild(header); panel.appendChild(body);
  div.appendChild(panel);
  return div;
}

function createActionItem(action) {
  const el = document.createElement('div');
  el.className = 'action-item';
  const label = getActionLabel(action);
  const icon = getActionIcon(action);
  const header = document.createElement('div');
  header.className = 'action-item-header';
  header.innerHTML = `
    <span class="action-item-icon">${icon}</span>
    <span class="action-item-label">${escHtml(label)}</span>
    <span class="action-item-chevron">▾</span>
  `;
  const body = document.createElement('div');
  body.className = 'action-item-body';
  body.innerHTML = `
    <div class="action-json">${escHtml(JSON.stringify(action, null, 2))}</div>
    <div class="action-output running" id="out_${Math.random().toString(36).slice(2)}">Running...</div>
  `;
  header.onclick = () => {
    header.classList.toggle('open');
    body.classList.toggle('open');
  };
  // Default open
  header.classList.add('open');
  body.classList.add('open');
  el.appendChild(header); el.appendChild(body);
  const outEl = body.querySelector('.action-output');
  return { el, outEl, header };
}

function getActionLabel(action) {
  switch (action.action) {
    case 'run code': case 'run': return `Run ${action.lang || 'code'}`;
    case 'execute': return 'Execute Lua';
    case 'git': return `Git: ${action.command || action.subcmd || ''}`;
    case 'read file': case 'readfile': return `Read: ${action.path || ''}`;
    case 'write file': case 'writefile': return `Write: ${action.path || ''}`;
    case 'delete file': case 'deletefile': return `Delete: ${action.path || ''}`;
    case 'list files': return `List: ${action.path || '/'}`;
    case 'create project': return `Create project: ${action.projectId || ''}`;
    case 'shell': case 'bash': return `Shell: ${(action.command || '').slice(0, 40)}`;
    default: return action.action || 'Action';
  }
}

function getActionIcon(action) {
  switch (action.action) {
    case 'run code': case 'run': return '>_';
    case 'execute': return '▶';
    case 'git': return '⎇';
    case 'read file': case 'readfile': return '📄';
    case 'write file': case 'writefile': return '✏️';
    case 'delete file': case 'deletefile': return '🗑';
    case 'list files': return '📁';
    case 'create project': return '📦';
    case 'shell': case 'bash': return '$';
    default: return '⊕';
  }
}

// ── EXECUTE ACTION ──
async function executeAction(action, panel) {
  // Find the matching item in panel
  const idx = panel._actionItems.findIndex(i => i.el.querySelector('.action-item-label')?.textContent === getActionLabel(action));
  const item = panel._actionItems[idx >= 0 ? idx : 0];
  if (!item) return;

  const outEl = item.outEl;
  outEl.textContent = 'Running...';
  outEl.className = 'action-output running';

  let result = '';
  let ok = true;

  try {
    switch (action.action) {
      case 'run code':
      case 'run': {
        const lang = action.lang || action.language || 'python';
        const source = action.source || action.code || '';
        const r = await fetch(`${API}/api/exec`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang, source })
        });
        const d = await r.json();
        ok = d.ok;
        result = d.output || '';
        break;
      }
      case 'execute': {
        // Lua — send back to Roblox via history note
        result = '(Lua execution is handled inside Roblox by the Lua client)';
        break;
      }
      case 'git': {
        const pid = action.projectId || 'default';
        const act = action.command || action.subcmd || 'status';
        const r = await fetch(`${API}/api/git/${pid}/${act}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.opts || action)
        });
        const d = await r.json();
        ok = d.ok;
        result = d.ok ? JSON.stringify(d.result, null, 2) : d.error;
        break;
      }
      case 'read file':
      case 'readfile': {
        const pid = action.projectId || 'default';
        const r = await fetch(`${API}/api/files/${pid}/read?path=${encodeURIComponent(action.path || '')}`);
        const d = await r.json();
        ok = d.ok;
        result = d.ok ? d.content : d.error;
        break;
      }
      case 'write file':
      case 'writefile': {
        const pid = action.projectId || 'default';
        const r = await fetch(`${API}/api/files/${pid}/write`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: action.path, content: action.content || '' })
        });
        const d = await r.json();
        ok = d.ok;
        result = d.ok ? `File written: ${action.path}` : d.error;
        break;
      }
      case 'list files': {
        const pid = action.projectId || 'default';
        const r = await fetch(`${API}/api/files/${pid}/tree`);
        const d = await r.json();
        ok = d.ok;
        result = d.ok ? JSON.stringify(d.tree, null, 2) : d.error;
        break;
      }
      case 'create project': {
        const pid = action.projectId || 'project_' + Date.now();
        const r = await fetch(`${API}/api/files/project/create`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: pid })
        });
        const d = await r.json();
        ok = d.ok;
        result = d.ok ? `Project '${pid}' created` : d.error;
        if (d.ok && wsReady) {
          ws.send(JSON.stringify({ type: 'register_project', projectId: pid }));
        }
        break;
      }
      default: {
        result = `Unknown action: ${action.action}`;
        ok = false;
      }
    }
  } catch (err) {
    ok = false;
    result = err.message;
  }

  outEl.textContent = result;
  outEl.className = `action-output${ok ? '' : ' error'}`;

  // Feed result back into history so AI can see it
  history.push({ role: 'user', content: `[Action result for "${action.action}"]: ${result.slice(0, 2000)}` });

  // Get AI follow-up after action
  try {
    const followUp = await callAI();
    const { content, thinking } = followUp;
    // Only process non-action follow-up here
    const hasAction = /\{[\s\S]*?"action"\s*:/.test(content);
    if (!hasAction && content && content !== '[Error] No response returned.') {
      history.push({ role: 'assistant', content });
      if (thinking) {
        // Show thinking inline if needed
      }
      // Show follow-up bubble after the panel
      await appendAIMsgAnimated(content, streamMode);
    } else if (hasAction) {
      await processAIResponse(followUp);
    } else {
      history.push({ role: 'assistant', content });
    }
  } catch (_) {}
}

// ── MESSAGE RENDERING ──
function appendUserMsg(text) {
  const div = document.createElement('div');
  div.className = 'msg-row';
  const bubble = document.createElement('div');
  bubble.className = 'msg-user msg-content';
  bubble.innerHTML = escHtml(text).replace(/\n/g, '<br>');
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  scrollDown();
}

async function appendAIMsgAnimated(text, doStream) {
  const div = document.createElement('div');
  div.className = 'msg-row';
  const bubble = document.createElement('div');
  bubble.className = 'msg-ai msg-content';
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  scrollDown();

  const parsed = renderMarkdown(text);
  if (doStream) {
    // Typewriter: extract plain text chars and type them in
    bubble.innerHTML = '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = parsed;
    const fullText = tempDiv.textContent;
    let i = 0;
    await new Promise(resolve => {
      function typeNext() {
        if (i >= fullText.length) { bubble.innerHTML = parsed; resolve(); return; }
        const chunk = fullText.slice(0, i + 1);
        bubble.textContent = chunk;
        i += Math.ceil(15 * (0.5 + Math.random()));
        if (i >= fullText.length) { bubble.innerHTML = parsed; resolve(); return; }
        setTimeout(typeNext, 1000 / 60);
        scrollDown();
      }
      typeNext();
    });
  } else {
    bubble.innerHTML = parsed;
  }
  scrollDown();
  return div;
}

function appendAIMsg(text) {
  const div = document.createElement('div');
  div.className = 'msg-row';
  const bubble = document.createElement('div');
  bubble.className = 'msg-ai msg-content';
  bubble.innerHTML = renderMarkdown(text);
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  scrollDown();
  return div;
}

function appendWorking() {
  const div = document.createElement('div');
  div.className = 'msg-row';
  const wrap = document.createElement('div');
  wrap.className = 'working-indicator';
  wrap.innerHTML = `<span style="color:var(--text-muted);font-size:13px;">Working</span><div class="working-dots"><span></span><span></span><span></span></div>`;
  div.appendChild(wrap);
  messagesEl.appendChild(div);
  scrollDown();
  return div;
}

function renderStoredMessage(msg) {
  if (msg.role === 'user') appendUserMsg(msg.content);
  else if (msg.role === 'assistant') appendAIMsg(msg.content);
}

// ── CODE BLOCKS with run button ──
function renderMarkdown(text) {
  if (!text) return '';

  // Code blocks
  text = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) => {
    const l = (lang || '').toLowerCase().trim() || 'text';
    const id = 'cb_' + Math.random().toString(36).slice(2);
    const runnable = ['python','py','javascript','js','c++','cpp','c','lua','bash','sh'].includes(l);
    return `<div class="code-block">
      <div class="code-toolbar">
        <span class="code-lang">${l}</span>
        <div class="code-actions">
          ${runnable ? `<button class="code-btn run-btn" onclick="runCodeBlock('${id}','${l}')">▶ Run</button>` : ''}
          <button class="code-btn" onclick="copyCode('${id}')">Copy</button>
        </div>
      </div>
      <pre id="${id}_code"><code>${highlight(escHtml(code.trim()), l)}</code></pre>
      <div class="code-run-output" id="${id}_out"></div>
    </div>`;
  });

  // Inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Headers
  text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  text = text.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Bullets
  text = text.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>\n?)+/g, s => `<ul>${s}</ul>`);
  // Numbered lists
  text = text.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  // HR
  text = text.replace(/^---$/gm, '<hr>');
  // Paragraphs
  text = text.replace(/\n\n+/g, '</p><p>');
  text = `<p>${text}</p>`;
  // Newlines
  text = text.replace(/<\/p><p>/g, '</p><p>');
  text = text.replace(/\n/g, '<br>');

  return text;
}

// ── SYNTAX HIGHLIGHT (simple) ──
function highlight(code, lang) {
  const KW = {
    lua: ['and','break','do','else','elseif','end','false','for','function','goto','if','in','local','nil','not','or','repeat','return','then','true','until','while'],
    python: ['False','None','True','and','as','assert','async','await','break','class','continue','def','del','elif','else','except','finally','for','from','global','if','import','in','is','lambda','not','or','pass','raise','return','try','while','with','yield'],
    javascript: ['break','case','catch','class','const','continue','debugger','default','delete','do','else','export','extends','false','finally','for','function','if','import','in','instanceof','let','new','null','return','static','super','switch','this','throw','true','try','typeof','undefined','var','void','while','yield','async','await','of'],
    cpp: ['auto','break','case','catch','char','class','const','continue','default','delete','do','double','else','enum','extern','false','float','for','if','include','inline','int','long','namespace','new','nullptr','operator','private','protected','public','return','short','static','struct','switch','template','this','throw','true','try','typedef','union','unsigned','using','virtual','void','while'],
    c: ['auto','break','case','char','const','continue','default','do','double','else','enum','extern','float','for','goto','if','inline','int','long','register','return','short','signed','sizeof','static','struct','switch','typedef','union','unsigned','void','volatile','while'],
  };
  const map = KW[lang] || KW.javascript || [];

  // Strings
  code = code.replace(/(["'`])(.*?)\1/g, '<span class="s-str">$1$2$1</span>');
  // Comments
  code = code.replace(/(\/\/[^\n]*|--[^\n]*|#[^\n]*)/g, '<span class="s-cmt">$1</span>');
  // Numbers
  code = code.replace(/\b(\d+\.?\d*)\b/g, '<span class="s-num">$1</span>');
  // Keywords
  if (map.length) {
    const pat = new RegExp(`\\b(${map.join('|')})\\b`, 'g');
    code = code.replace(pat, '<span class="s-kw">$1</span>');
  }
  return code;
}

window.runCodeBlock = async function(id, lang) {
  const codeEl = document.getElementById(id + '_code');
  const outEl = document.getElementById(id + '_out');
  if (!codeEl || !outEl) return;
  const source = codeEl.innerText || codeEl.textContent;
  outEl.textContent = 'Running...';
  outEl.className = 'code-run-output visible';
  outEl.classList.remove('err');
  try {
    const r = await fetch(`${API}/api/exec`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: lang === 'py' ? 'python' : lang === 'js' ? 'javascript' : lang, source })
    });
    const d = await r.json();
    outEl.textContent = d.output || '(no output)';
    if (!d.ok) outEl.classList.add('err');
  } catch (err) {
    outEl.textContent = err.message;
    outEl.classList.add('err');
  }
};

window.copyCode = function(id) {
  const el = document.getElementById(id + '_code');
  if (!el) return;
  navigator.clipboard.writeText(el.innerText || el.textContent).then(() => {}).catch(() => {});
};

// ── UTILS ──
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function scrollDown() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function removeEmpty() {
  const e = document.getElementById('empty-state');
  if (e) e.remove();
}
window.loadChat = loadChat;
