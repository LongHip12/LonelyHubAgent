const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || './data';
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');

function safePath(projectId, filePath) {
  const base = path.resolve(path.join(PROJECTS_DIR, projectId));
  const full = path.resolve(path.join(base, filePath.replace(/^\/+/, '')));
  if (!full.startsWith(base)) throw new Error('Path traversal denied');
  return full;
}

// GET /api/files/:projectId/tree
router.get('/:projectId/tree', (req, res) => {
  const base = path.join(PROJECTS_DIR, req.params.projectId);
  if (!fs.existsSync(base)) return res.json({ ok: true, tree: [] });
  function buildTree(dir, rel = '') {
    const items = [];
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith('.git')) continue;
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      const relPath = rel ? `${rel}/${name}` : name;
      if (stat.isDirectory()) {
        items.push({ name, path: relPath, type: 'dir', children: buildTree(full, relPath) });
      } else {
        items.push({ name, path: relPath, type: 'file', size: stat.size });
      }
    }
    return items;
  }
  res.json({ ok: true, tree: buildTree(base) });
});

// GET /api/files/:projectId/read?path=...
router.get('/:projectId/read', (req, res) => {
  try {
    const fp = safePath(req.params.projectId, req.query.path || '');
    if (!fs.existsSync(fp)) return res.status(404).json({ ok: false, error: 'File not found' });
    const content = fs.readFileSync(fp, 'utf8');
    res.json({ ok: true, content });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/files/:projectId/write
// Body: { path, content }
router.post('/:projectId/write', (req, res) => {
  try {
    const { path: filePath, content = '' } = req.body;
    const fp = safePath(req.params.projectId, filePath);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, content, 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// DELETE /api/files/:projectId/delete?path=...
router.delete('/:projectId/delete', (req, res) => {
  try {
    const fp = safePath(req.params.projectId, req.query.path || '');
    if (!fs.existsSync(fp)) return res.status(404).json({ ok: false, error: 'Not found' });
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) {
      fs.rmSync(fp, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fp);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/files/:projectId/mkdir
router.post('/:projectId/mkdir', (req, res) => {
  try {
    const { path: dirPath } = req.body;
    const fp = safePath(req.params.projectId, dirPath);
    fs.mkdirSync(fp, { recursive: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/files/:projectId/copy
router.post('/:projectId/copy', (req, res) => {
  try {
    const { from, to } = req.body;
    const src = safePath(req.params.projectId, from);
    const dst = safePath(req.params.projectId, to);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/files/:projectId/rename
router.post('/:projectId/rename', (req, res) => {
  try {
    const { from, to } = req.body;
    const src = safePath(req.params.projectId, from);
    const dst = safePath(req.params.projectId, to);
    fs.renameSync(src, dst);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/files/project/create — create a new project folder
router.post('/project/create', (req, res) => {
  const { projectId } = req.body;
  if (!projectId || !/^[a-zA-Z0-9_-]+$/.test(projectId))
    return res.status(400).json({ ok: false, error: 'Invalid projectId' });
  const dir = path.join(PROJECTS_DIR, projectId);
  fs.mkdirSync(dir, { recursive: true });
  res.json({ ok: true, projectId, dir: dir });
});

module.exports = router;
