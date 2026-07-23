const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const TIMEOUT_MS = 15000;

function run(lang, source) {
  return new Promise((resolve) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-'));
    let cleanup = () => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    };

    let cmd, args;

    if (lang === 'python' || lang === 'py') {
      const file = path.join(tmpDir, 'main.py');
      fs.writeFileSync(file, source);
      cmd = 'python3';
      args = [file];
    } else if (lang === 'javascript' || lang === 'js' || lang === 'node') {
      const file = path.join(tmpDir, 'main.js');
      fs.writeFileSync(file, source);
      cmd = 'node';
      args = [file];
    } else if (lang === 'c++' || lang === 'cpp') {
      const src = path.join(tmpDir, 'main.cpp');
      const out = path.join(tmpDir, 'main');
      fs.writeFileSync(src, source);
      try {
        execSync(`g++ -o ${out} ${src} 2>&1`, { timeout: 10000 });
      } catch (e) {
        cleanup();
        return resolve({ ok: false, output: e.stdout ? e.stdout.toString() : e.message, exitCode: 1 });
      }
      cmd = out;
      args = [];
    } else if (lang === 'c') {
      const src = path.join(tmpDir, 'main.c');
      const out = path.join(tmpDir, 'main');
      fs.writeFileSync(src, source);
      try {
        execSync(`gcc -o ${out} ${src} 2>&1`, { timeout: 10000 });
      } catch (e) {
        cleanup();
        return resolve({ ok: false, output: e.stdout ? e.stdout.toString() : e.message, exitCode: 1 });
      }
      cmd = out;
      args = [];
    } else if (lang === 'lua') {
      // Lua (non-Roblox) - try local lua binary
      const file = path.join(tmpDir, 'main.lua');
      fs.writeFileSync(file, source);
      cmd = 'lua';
      args = [file];
    } else if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
      const file = path.join(tmpDir, 'main.sh');
      fs.writeFileSync(file, source);
      cmd = 'bash';
      args = [file];
    } else {
      cleanup();
      return resolve({ ok: false, output: `Language '${lang}' not supported. Supported: python, javascript, c++, c, lua, bash`, exitCode: 1 });
    }

    let stdout = '';
    let stderr = '';
    let done = false;

    const proc = spawn(cmd, args, {
      cwd: tmpDir,
      timeout: TIMEOUT_MS,
      env: { ...process.env, PATH: process.env.PATH },
    });

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        proc.kill('SIGKILL');
        cleanup();
        resolve({ ok: false, output: '[Timeout] Execution exceeded 15 seconds.', exitCode: -1 });
      }
    }, TIMEOUT_MS);

    proc.on('close', (code) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        cleanup();
        const combined = [stdout, stderr].filter(Boolean).join('\n').trim();
        resolve({ ok: code === 0, output: combined || '(no output)', exitCode: code });
      }
    });

    proc.on('error', (err) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        cleanup();
        resolve({ ok: false, output: err.message, exitCode: 1 });
      }
    });
  });
}

module.exports = { run };
