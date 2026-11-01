// Testlauf: bündelt jede Testdatei mit esbuild (die App nutzt Importe ohne Dateiendung) und startet node --test.
// Aufruf: npm test   (im Ordner app/)
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(dir, '.build');
fs.rmSync(out, { recursive: true, force: true });
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js'));
await esbuild.build({
  entryPoints: files.map((f) => path.join(dir, f)),
  bundle: true, platform: 'node', format: 'esm', outdir: out, outExtension: { '.js': '.mjs' },
  jsx: 'automatic', define: { 'process.env.NODE_ENV': '"test"', __DEV__: 'false' }, logLevel: 'error',
});
const r = spawnSync(process.execPath, ['--test', ...files.map((f) => path.join(out, f.replace(/\.js$/, '.mjs')))], { stdio: 'inherit' });
process.exit(r.status ?? 1);
