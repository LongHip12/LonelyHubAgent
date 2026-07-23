require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { initWS } = require('./src/ws/manager');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/exec', require('./src/routes/exec'));
app.use('/api/git', require('./src/routes/git'));
app.use('/api/files', require('./src/routes/files'));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Init WebSocket
initWS(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`LonelyHub AI Agent running on port ${PORT}`);
});
