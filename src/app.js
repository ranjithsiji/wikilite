const $ = id => document.getElementById(id);
const form = $('form'), input = $('q'), sug = $('sug'), main = $('main'), select = $('lang'), imgBox = $('img');

const parseLangs = text => text.split('|').map(s => [s.slice(0, s.indexOf(' ')), s.slice(s.indexOf(' ') + 1)]);
// Shown without any network request. "More languages" fetches the rest on demand.
const LANGS = parseLangs('en English|hi हिन्दी|ml മലയാളം|ta தமிழ்|te తెలుగు|kn ಕನ್ನಡ|bn বাংলা|mr मराठी|gu ગુજરાતી|pa ਪੰਜਾਬੀ|or ଓଡ଼ିଆ|as অসমীয়া|ur اردو|sa संस्कृतम्|ne नेपाली|si සිංහල|ar العربية|es Español|fr Français|de Deutsch|it Italiano|pt Português|ru Русский|zh 中文|ja 日本語|ko 한국어|id Indonesia|tr Türkçe|vi Tiếng Việt|fa فارسی|he עברית|nl Nederlands|pl Polski|uk Українська|sv Svenska|sw Kiswahili');
const RTL = /^(ar|arc|arz|azb|ckb|dv|fa|glk|he|khw|ks|lrc|mzn|nqo|pnb|ps|sd|skr|ug|ur|yi)$/;
// Removed from image-mode articles: they cost bytes and mean nothing away from Wikipedia.
const JUNK = '[data-hidden],link,meta,script,.mw-editsection,.reference,.reflist,.mw-references-wrap,.references,.navbox,.ambox,.metadata,.noprint,.sistersitebox,.mw-empty-elt';

const store = (key, value) => {
	try {
		if (value === undefined) return localStorage.getItem(key);
		localStorage.setItem(key, value);
	} catch (e) {}
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const wikiHash = (code, title) => `#/${code}/wiki/${encodeURIComponent(title).replace(/%20/g, '_')}`;
const onWiki = title => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
const wikiAttrs = () => `lang="${lang}" dir="${RTL.test(lang) ? 'rtl' : 'ltr'}"`;

let lang, images = store('img') === '1';

function setLang(code) {
	lang = code;
	store('lang', code);
	if (![...select.options].some(o => o.value === code)) select.add(new Option(code, code), 1);
	select.value = code;
	$('info').textContent = `Just start typing to search in ${select.options[select.selectedIndex].text} Wikipedia`;
	form.action = `https://${code}.wikipedia.org/w/index.php`;
	input.lang = code;
	// Do the TLS handshake now so the first suggestion doesn't pay for it.
	const hint = document.createElement('link');
	hint.rel = 'preconnect';
	hint.href = `https://${code}.wikipedia.org`;
	hint.crossOrigin = 'anonymous';
	document.head.append(hint);
}

/* ---- API ---- */

const memo = new Map();
const remember = (map, key, value, max) => {
	if (map.size >= max) map.delete(map.keys().next().value);
	map.set(key, value);
};

async function api(params, signal) {
	// maxage lets the browser and Wikimedia's CDN answer repeat requests without reaching the API.
	const query = new URLSearchParams({ action: 'query', format: 'json', formatversion: 2, origin: '*', maxage: 3600, smaxage: 3600, ...params });
	const url = `https://${lang}.wikipedia.org/w/api.php?${query}`;
	if (memo.has(url)) return memo.get(url);
	const res = await fetch(url, { signal });
	if (!res.ok) throw new Error(res.status === 429 ? 'Wikipedia is limiting requests. Wait a moment and retry.' : `Wikipedia returned an error (${res.status}).`);
	const data = await res.json();
	if (data.error) throw new Error(data.error.info);
	remember(memo, url, data, 40);
	return data;
}

/* ---- Suggestions ---- */

// Prefix lists known to be complete. Typing further only narrows them, so no request is needed.
const complete = new Map();
let timer, sugCtl, active = -1;

function closeSug() {
	clearTimeout(timer);
	if (sugCtl) sugCtl.abort();
	sug.hidden = true;
	active = -1;
	input.setAttribute('aria-expanded', 'false');
	input.removeAttribute('aria-activedescendant');
}

function showSug(pages) {
	sug.innerHTML = pages.map((p, i) => `<a id="s${i}" role="option" href="${esc(wikiHash(lang, p.title))}">${esc(p.title)}${p.description ? `<small>${esc(p.description)}</small>` : ''}</a>`).join('');
	sug.hidden = !pages.length;
	active = -1;
	input.setAttribute('aria-expanded', String(!sug.hidden));
}

function narrowed(q) {
	const lower = q.toLowerCase();
	for (let i = lower.length - 1; i > 0; i--) {
		const pages = complete.get(lang + lower.slice(0, i));
		if (pages) {
			const hits = pages.filter(p => p.title.toLowerCase().startsWith(lower));
			// Redirected titles can fail this test, so an empty result still asks the server.
			return hits.length ? hits : null;
		}
	}
	return null;
}

async function suggest(q) {
	const local = narrowed(q);
	if (local) return showSug(local);
	sugCtl = new AbortController();
	try {
		const data = await api({ generator: 'prefixsearch', gpssearch: q, gpslimit: 8, gpsnamespace: 0, prop: 'description', redirects: 1 }, sugCtl.signal);
		const pages = ((data.query && data.query.pages) || []).sort((a, b) => a.index - b.index);
		if (!data.continue) remember(complete, lang + q.toLowerCase(), pages, 50);
		if (input.value.trim() === q && document.activeElement === input) showSug(pages);
	} catch (e) {
		// Suggestions are optional. The Search button still works, so stay quiet.
	}
}

input.addEventListener('input', () => {
	closeSug();
	const q = input.value.trim();
	// One Latin letter matches too much, but one CJK character is often a whole word.
	if (q.length > 1 || q.charCodeAt(0) > 127) timer = setTimeout(suggest, 250, q);
});
input.addEventListener('blur', closeSug);
sug.addEventListener('mousedown', e => e.preventDefault());
sug.addEventListener('click', () => { closeSug(); input.blur(); });

input.addEventListener('keydown', e => {
	if (e.key === 'Escape') {
		// Browsers also clear a search box on Esc, which should not happen when just closing the list.
		if (!sug.hidden) e.preventDefault();
		return closeSug();
	}
	if (sug.hidden || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
	e.preventDefault();
	const items = sug.children;
	if (items[active]) items[active].classList.remove('on');
	active = e.key === 'ArrowDown' ? (active + 1) % items.length : (active - 1 + items.length) % items.length;
	items[active].classList.add('on');
	input.setAttribute('aria-activedescendant', items[active].id);
});

form.addEventListener('submit', e => {
	e.preventDefault();
	const picked = sug.children[active];
	const q = input.value.trim();
	const target = !sug.hidden && picked ? picked.getAttribute('href') : q && `#/${lang}/search/${encodeURIComponent(q)}`;
	closeSug();
	if (target) {
		input.blur();
		go(target);
	}
});

/* ---- Views ---- */

// The security policy blocks inline styles, and browsers report each one as soon as it is
// parsed, so they go before parsing. Literal "<" in article text is escaped, so only real
// tags match. Elements hidden by a style are marked, or their text would become visible.
const stripStyles = html => html
	.replace(/<style[\s\S]*?<\/style>/gi, '')
	.replace(/<[a-z][^<>]*>/gi, tag => tag.replace(/\sstyle="([^"]*)"/i, (m, css) => /display:\s*none/i.test(css) ? ' data-hidden' : ''));

function clean(html) {
	// A parsed document is inert: nothing in it downloads until it is added to the page.
	const root = new DOMParser().parseFromString(stripStyles(html), 'text/html').body;
	root.querySelectorAll(JUNK).forEach(el => el.remove());
	root.querySelectorAll('img').forEach(img => {
		const src = img.getAttribute('src') || '';
		img.src = src.startsWith('//') ? 'https:' + src : src;
		// srcset would pick double-size images on high-density phone screens.
		img.removeAttribute('srcset');
		img.loading = 'lazy';
		img.decoding = 'async';
	});
	root.querySelectorAll('a[href]').forEach(a => {
		const href = a.getAttribute('href');
		const page = /^\/wiki\/([^#?]+)/.exec(href);
		if (page && a.querySelector('img')) a.href = `https://${lang}.wikipedia.org${href}`;
		else if (page) a.href = `#/${lang}/wiki/${page[1]}`;
		else if (!/^https?:|^\/\//.test(href)) a.removeAttribute('href');
	});
	// Removing references and navboxes leaves their headings behind with nothing under them.
	const isHeading = el => el && /^(H[2-6])$|mw-heading/.test(el.tagName + ' ' + el.className);
	[...root.querySelectorAll('h2,h3,h4,h5,h6,.mw-heading')].reverse().forEach(h => {
		if (h.parentElement && h.parentElement.classList.contains('mw-heading')) return;
		if (!h.nextElementSibling || isHeading(h.nextElementSibling)) h.remove();
	});
	return root;
}

function fail(err, title) {
	if (err.name === 'AbortError') return;
	const msg = err instanceof TypeError ? 'No connection to Wikipedia.' : err.message;
	main.innerHTML = `<p>${esc(msg)}</p><button data-do="retry">Retry</button>${title ? ` <a href="#/${lang}/search/${esc(encodeURIComponent(title))}">Search for this title</a>` : ''}`;
	ready = false;
}

async function showArticle(title, signal, full) {
	const page = images
		? (await api({ action: 'parse', page: title, prop: 'text', redirects: 1, disableeditsection: 1, disablelimitreport: 1, disabletoc: 1, ...(full ? {} : { section: 0 }) }, signal)).parse
		: (await api({ prop: 'extracts', titles: title, redirects: 1, ...(full ? {} : { exintro: 1 }) }, signal)).query.pages[0];
	if (page.missing) throw new Error('No article with this title.');
	const body = clean(images ? page.text : page.extract || '');
	main.innerHTML = `<button class="close" data-do="close">Close</button><article ${wikiAttrs()}><h1>${esc(page.title)}</h1><div id="body"></div></article>${full ? '' : `<button class="more" data-do="full" data-title="${esc(title)}">Read full article</button>`}<p class="bar"><a href="${esc(onWiki(page.title))}">Read or edit on Wikipedia</a></p>`;
	$('body').append(...body.childNodes);
	document.title = `${page.title} - WikiLite`;
	input.value = '';
	ready = true;
}

function resultHtml(r) {
	// Snippets are HTML, but only their highlight spans are worth keeping.
	const snippet = r.snippet.replace(/<(?!\/?span\b)[^>]*>/g, '');
	return `<div class="r" ${wikiAttrs()}><h2><a href="${esc(wikiHash(lang, r.title))}">${esc(r.title)}</a></h2><p>${snippet}</p><small>${r.wordcount} words</small></div>`;
}

async function showSearch(q, signal, offset) {
	const data = await api({ list: 'search', srsearch: q, srprop: 'snippet|wordcount', srinfo: 'suggestion', srlimit: 10, sroffset: offset || 0 }, signal);
	const found = data.query.search, next = data.continue && data.continue.sroffset;
	const moreBtn = next ? `<button class="more" data-do="next" data-q="${esc(q)}" data-offset="${next}">More results</button>` : '';
	if (offset) {
		main.querySelector('.more').remove();
		main.insertAdjacentHTML('beforeend', found.map(resultHtml).join('') + moreBtn);
		return;
	}
	const hint = data.query.searchinfo && data.query.searchinfo.suggestion;
	main.innerHTML = (hint ? `<p>Did you mean <a href="#/${lang}/search/${esc(encodeURIComponent(hint))}">${esc(hint)}</a>?</p>` : '')
		+ (found.length ? found.map(resultHtml).join('') + moreBtn : `<p>No results for “${esc(q)}”.</p>`);
	document.title = `${q} - WikiLite`;
	input.value = q;
	ready = true;
}

function showHome() {
	main.innerHTML = `<p class="hint">${images ? 'Articles open with images.' : 'Articles open as text to save data. Tick Images to see pictures.'}</p>`;
	document.title = 'WikiLite';
	input.value = '';
	ready = true;
}

/* ---- Router ---- */

// Finished views by URL, so Back is instant and keeps "More results" and the scroll position.
const views = new Map();
let viewKey, ready = false, ctl, current = {}, lastQuery;

function parseHash() {
	const m = /^#\/([a-z0-9-]{2,40})(?:\/(wiki|search)\/(.+))?$/.exec(location.hash);
	if (!m) return {};
	let arg = m[3];
	try { arg = arg && decodeURIComponent(arg); } catch (e) {}
	return { code: m[1], view: m[2], arg: m[2] === 'wiki' ? arg.replace(/_/g, ' ') : arg };
}

function render() {
	if (ready && viewKey) remember(views, viewKey, { html: main.innerHTML, y: scrollY, title: document.title, q: input.value }, 20);
	if (ctl) ctl.abort();
	ctl = new AbortController();
	closeSug();
	current = parseHash();
	document.body.classList.toggle('home', !current.view);
	if (current.code && current.code !== lang) setLang(current.code);
	if (current.view === 'search') lastQuery = current.arg;
	// Results look the same in both image modes, so toggling Images must not lose them.
	viewKey = location.hash + lang + (current.view === 'search' ? '' : images);
	const saved = views.get(viewKey);
	if (saved) {
		main.innerHTML = saved.html;
		document.title = saved.title;
		input.value = current.view ? saved.q : '';
		ready = true;
		scrollTo(0, saved.y);
		return;
	}
	ready = false;
	scrollTo(0, 0);
	if (!current.view) return showHome();
	main.innerHTML = '<p>Loading…</p>';
	const { view, arg } = current;
	(view === 'wiki' ? showArticle(arg, ctl.signal) : showSearch(arg, ctl.signal)).catch(err => fail(err, view === 'wiki' && arg));
}

function go(hash) {
	if (location.hash === hash) render();
	else location.hash = hash;
}

main.addEventListener('click', e => {
	const btn = e.target.closest('[data-do]');
	if (!btn) return;
	const action = btn.dataset.do;
	if (action === 'retry') return render();
	// Without an earlier search (a suggestion or shared link), search for the article's title.
	if (action === 'close') return go(`#/${lang}/search/${encodeURIComponent(lastQuery || current.arg)}`);
	btn.disabled = true;
	btn.textContent = 'Loading…';
	const restore = err => {
		if (err.name === 'AbortError') return;
		btn.disabled = false;
		btn.textContent = 'Failed. Retry';
	};
	if (action === 'full') showArticle(btn.dataset.title, ctl.signal, true).catch(restore);
	if (action === 'next') showSearch(btn.dataset.q, ctl.signal, +btn.dataset.offset).catch(restore);
});

/* ---- Language and image controls ---- */

async function fetchLangs() {
	// The site's own list is under half the size of the API's answer, but can't load from disk.
	try {
		const res = await fetch('langs.txt');
		if (res.ok) return parseLangs(await res.text());
	} catch (e) {}
	const data = await api({ action: 'sitematrix', smtype: 'language', smlangprop: 'name|site', smsiteprop: 'code|url' });
	const all = Object.values(data.sitematrix).map(l => {
		const wiki = l.site && l.site.find(s => s.code === 'wiki' && !s.closed);
		return wiki && [new URL(wiki.url).hostname.split('.')[0], l.name];
	}).filter(Boolean);
	if (!all.length) throw new Error('Empty language list');
	return all;
}

async function loadAllLangs() {
	const moreOption = select.lastElementChild;
	moreOption.text = 'Loading…';
	select.value = lang;
	let all = null;
	try { all = JSON.parse(store('langs')); } catch (e) {}
	if (!all) {
		try {
			all = await fetchLangs();
			store('langs', JSON.stringify(all));
		} catch (e) {
			moreOption.text = 'Failed. Try again';
			return;
		}
	}
	moreOption.remove();
	const known = new Set([...select.options].map(o => o.value));
	all.filter(l => !known.has(l[0])).sort((a, b) => a[1].localeCompare(b[1])).forEach(l => select.add(new Option(l[1], l[0])));
	select.value = lang;
	select.focus();
}

select.addEventListener('change', async () => {
	const code = select.value;
	if (code === '*') return loadAllLangs();
	const { view, arg } = current;
	if (view === 'search') return go(`#/${code}/search/${encodeURIComponent(arg)}`);
	if (view !== 'wiki') return go(`#/${code}`);
	// The same article has a different title on each language's Wikipedia.
	select.disabled = true;
	try {
		const data = await api({ prop: 'langlinks', titles: arg, redirects: 1, lllang: code, lllimit: 1 });
		const link = data.query.pages[0].langlinks;
		go(link ? wikiHash(code, link[0].title) : `#/${code}/search/${encodeURIComponent(arg)}`);
	} catch (e) {
		go(`#/${code}/search/${encodeURIComponent(arg)}`);
	}
	select.disabled = false;
});

imgBox.checked = images;
imgBox.addEventListener('change', () => {
	images = imgBox.checked;
	store('img', images ? '1' : '0');
	render();
});

const setDark = on => document.documentElement.classList.toggle('dark', on);
$('dark').checked = store('dark') === '1';
setDark($('dark').checked);
$('dark').addEventListener('change', e => {
	setDark(e.target.checked);
	store('dark', e.target.checked ? '1' : '0');
});

/* ---- Start ---- */

select.innerHTML = '';
LANGS.forEach(l => select.add(new Option(l[1], l[0])));
select.add(new Option('More languages…', '*'));

const browserLang = (navigator.language || '').split('-')[0];
setLang(parseHash().code || store('lang') || (LANGS.some(l => l[0] === browserLang) ? browserLang : 'en'));
addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator && /^https:|^http:\/\/localhost/.test(location.href)) navigator.serviceWorker.register('sw.js');
