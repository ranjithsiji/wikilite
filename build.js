// Inlines and minifies src/ into index.html and sw.js at the repo root,
// which is what GitHub Pages serves and what opening the file locally needs.
// Usage: node build.js [--serve | --langs]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, watch } from 'node:fs';
import { createServer } from 'node:http';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { build, transform } from 'esbuild';

// A first response this small arrives in one round trip (the TCP initial congestion window).
const BUDGET = 14 * 1024;
const target = 'es2018';
const sha = s => `'sha256-${createHash('sha256').update(s).digest('base64')}'`;

async function bundle() {
	const { outputFiles } = await build({ entryPoints: ['src/app.js'], bundle: true, minify: true, format: 'iife', target, write: false, legalComments: 'none' });
	const js = outputFiles[0].text.trim();
	const css = (await transform(readFileSync('src/style.css', 'utf8'), { loader: 'css', minify: true, target })).code.trim();
	const sw = (await transform(readFileSync('src/sw.js', 'utf8'), { minify: true, target })).code.trim();
	// Hashes let the page run its own inline code and nothing else. The extra image hosts are
	// for pictures and rendered maths in image mode.
	const csp = [
		"default-src 'none'",
		`script-src ${sha(js)}`,
		`style-src ${sha(css)}`,
		"connect-src 'self' https://*.wikipedia.org",
		'img-src https://*.wikimedia.org https://wikimedia.org data:',
		"worker-src 'self'",
		"base-uri 'none'",
		'form-action https://*.wikipedia.org',
	].join(';');
	const html = readFileSync('src/index.html', 'utf8')
		.replace(/>\s+</g, '><')
		.replace(/\s*\n\s*/g, '')
		.replace('{{CSP}}', () => csp)
		.replace('{{CSS}}', () => css)
		.replace('{{JS}}', () => js);
	writeFileSync('index.html', html);
	writeFileSync('sw.js', sw + '\n');
	writeFileSync('langs.txt', readFileSync('src/langs.txt'));

	const gz = gzipSync(html, { level: 9 }).length;
	console.log(`index.html ${html.length} B, gzip ${gz} B, brotli ${brotliCompressSync(html).length} B`);
	if (gz > BUDGET) throw new Error(`index.html is ${gz} B gzipped, over the ${BUDGET} B budget`);
}

// Refreshes the committed list of Wikipedias, so normal builds need no network.
async function updateLangs() {
	const api = 'https://en.wikipedia.org/w/api.php?action=sitematrix&smtype=language&smlangprop=name%7Csite&smsiteprop=code%7Curl&format=json&formatversion=2';
	const res = await fetch(api, { headers: { 'User-Agent': 'wikilite-build (https://github.com/ranjithsiji/wikilite)' } });
	if (!res.ok) throw new Error(`Language list request failed (${res.status})`);
	const rows = Object.values((await res.json()).sitematrix).flatMap(l => {
		const wiki = l.site && l.site.find(s => s.code === 'wiki' && !s.closed);
		return wiki ? [`${new URL(wiki.url).hostname.split('.')[0]} ${l.name}`] : [];
	});
	if (!rows.length) throw new Error('Language list came back empty');
	writeFileSync('src/langs.txt', rows.sort().join('|'));
	console.log(`src/langs.txt: ${rows.length} languages`);
}

if (process.argv.includes('--langs')) await updateLangs();
await bundle();

if (process.argv.includes('--serve')) {
	watch('src', () => bundle().catch(err => console.error(err.message)));
	const types = { 'sw.js': 'text/javascript', 'langs.txt': 'text/plain; charset=utf-8' };
	createServer((req, res) => {
		const file = req.url.slice(1).split('?')[0];
		res.setHeader('Content-Type', types[file] || 'text/html; charset=utf-8');
		res.end(readFileSync(types[file] ? file : 'index.html'));
	}).listen(8000, () => console.log('http://localhost:8000'));
}
