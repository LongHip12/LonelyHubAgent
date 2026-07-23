const express = require('express');
const router = express.Router();
const { run } = require('../sandbox/runner');

// POST /api/exec
// Body: { lang, source }
router.post('/', async (req, res) => {
  const { lang, source } = req.body;
  if (!lang || !source) {
    return res.status(400).json({ ok: false, output: 'Missing lang or source' });
  }
  try {
    const result = await run(lang.toLowerCase().trim(), source);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, output: err.message });
  }
});

module.exports = router;
