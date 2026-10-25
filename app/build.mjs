// Baut die App.
// node build.mjs --out ..   -> fertige Version direkt in die Repo-Wurzel (wird von GitHub Pages ausgeliefert)
// node build.mjs            -> fertige Version in app/dist/
// node build.mjs --serve    -> Entwicklungsserver auf http://localhost:5173
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const serve = args.includes('--serve');
const outIdx = args.indexOf('--out');
const out = serve ? 'dist' : outIdx >= 0 ? args[outIdx + 1] : 'dist';
const build = Date.now().toString(36);

if (out === 'dist') fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync('public', out, { recursive: true });

// Versionsnummer einsetzen, damit iPhone/iPad Updates sicher laden
const stamp = (file) => fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll('__BUILD__', build));
fs.copyFileSync('index.html', path.join(out, 'index.html'));
stamp(path.join(out, 'index.html'));
stamp(path.join(out, 'sw.js'));

const options = {
  entryPoints: ['src/main.jsx'],
  bundle: true,
  outdir: out, // alles in einem Ordner, ohne Unterordner
  entryNames: 'main',
  minify: !serve,
  sourcemap: serve,
  jsx: 'automatic',
  target: ['safari15'],
  define: {
    'process.env.NODE_ENV': serve ? '"development"' : '"production"',
    __DEV__: serve ? 'true' : 'false',
  },
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: 'dist', port: 5173 });
  console.log(`Läuft auf http://localhost:${port}`);
} else {
  await esbuild.build(options);
  console.log(`Fertig: Version ${build} in ${out}/`);
}
