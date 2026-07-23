const express = require('express');
const router = express.Router();
const { simpleGit } = require('simple-git');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || './data';
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');

function getGit(projectId) {
  const dir = path.join(PROJECTS_DIR, projectId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return simpleGit(dir);
}

// POST /api/git/:projectId/:action
router.post('/:projectId/:action', async (req, res) => {
  const { projectId, action } = req.params;
  const opts = req.body || {};
  const git = getGit(projectId);

  try {
    let result;
    switch (action) {
      case 'init':
        result = await git.init();
        break;
      case 'clone':
        if (!opts.url) return res.status(400).json({ ok: false, error: 'Missing url' });
        result = await simpleGit(path.join(PROJECTS_DIR, projectId)).clone(opts.url, '.', opts.args || []);
        break;
      case 'status':
        result = await git.status();
        break;
      case 'add':
        result = await git.add(opts.files || '.');
        break;
      case 'commit':
        if (!opts.message) return res.status(400).json({ ok: false, error: 'Missing message' });
        result = await git.commit(opts.message, opts.files || undefined);
        break;
      case 'push':
        result = await git.push(opts.remote || 'origin', opts.branch || 'main', opts.args || []);
        break;
      case 'pull':
        result = await git.pull(opts.remote || 'origin', opts.branch || 'main', opts.args || []);
        break;
      case 'log':
        result = await git.log({ maxCount: opts.limit || 20 });
        break;
      case 'branch':
        result = await git.branch(opts.args || []);
        break;
      case 'checkout':
        result = await git.checkout(opts.branch || opts.args || 'main');
        break;
      case 'diff':
        result = await git.diff(opts.args || []);
        break;
      case 'reset':
        result = await git.reset(opts.mode || 'soft', opts.args || []);
        break;
      case 'stash':
        result = await git.stash(opts.args || []);
        break;
      case 'tag':
        result = await git.tag(opts.args || []);
        break;
      case 'remote':
        result = await git.remote(opts.args || ['show']);
        break;
      case 'fetch':
        result = await git.fetch(opts.remote || 'origin', opts.branch || undefined);
        break;
      case 'merge':
        result = await git.merge(opts.args || []);
        break;
      default:
        return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
    }
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
