# Wikilite

A fast, lightweight Wikipedia reader for slow internet connections.

**Demo:** <http://ranjithsiji.github.io/wikilite>

The whole app is one HTML file of about 6 KB gzipped, with no framework. It fits in the first network round trip, and later visits load it from cache.

## How to use it

1. Type in the search box. Suggestions appear as you type, or press Enter to see full results.
2. Open a result. You get the article's introduction as text, which is usually only a few KB.
3. Choose **Read full article** to load the rest.
4. Choose **Close** to return to your search results, right where you left them.

Tick **Images** to see the article with its pictures and links. Images only download as you scroll to them. The choice is remembered.

The page is white by default. Tick **Dark** for the dark theme, and the choice is remembered.

Use the language menu to change Wikipedia. It lists common languages, and **More languages…** loads the rest. If you switch while reading, you go to the same article in the new language when one exists.

To use it without hosting, download `index.html` and open it in a browser. You still need an internet connection to reach Wikipedia.

### Data used

Measured on the English [Kerala](https://en.wikipedia.org/wiki/Kerala) article, compressed, excluding images:

| View | Size |
| --- | --- |
| Introduction, text only | 2 KB |
| Full article, text only | 39 KB |
| Introduction with images (plus the images shown) | 12 KB |
| Full article with images (plus the images you scroll to) | 215 KB |
| The same page on Wikipedia, HTML only | 357 KB |

## Development

You need Node.js. The source is in `src/`.

```sh
npm install
npm run dev     # builds, rebuilds on change, serves http://localhost:8000
npm run build   # one build
npm run langs   # refreshes the full language list from Wikipedia, then builds
```

The build inlines and minifies everything into `index.html`, and writes `sw.js` and `langs.txt`, all at the repo root. It fails if `index.html` is over 14 KB gzipped, the size that fits in the first round trip.

**Don't edit `index.html`, `sw.js` or `langs.txt` directly. Run `npm run build` and commit them with your source changes.** GitHub Pages serves these files from the root of `master`, so the live site only changes when they do.

## How it works

The app calls the MediaWiki API directly from the browser:

| Feature | API |
| --- | --- |
| Suggestions | `generator=prefixsearch` with `prop=description` |
| Search results | `list=search` |
| Text article | `prop=extracts` |
| Article with images | `action=parse` |
| Same article in another language | `prop=langlinks` |
| Full language list | `langs.txt` on the site, or `action=sitematrix` when opened from disk |

Search is kept light in these ways:

- It waits for a pause in typing and cancels requests that are out of date.
- It filters results it already has when typing only narrows them.
- It asks the browser and Wikimedia's CDN to cache responses.

The interface text is English only. Article content is in the chosen language.

## About Wikilite

The idea came from the question [Will Wikipedia survive for the next billion users?](https://meta.wikimedia.org/wiki/Talk:2015_Strategy/Community_consultation) Wikipedia can be slow on poor connections, especially in rural India, so quick access to its content matters.

Wikilite is for reading. To edit an article, use the Wikipedia link at the end of each page.

## Contributors

[Ranjith Siji](https://en.wikipedia.org/wiki/User:Ranjithsiji). Suggestions to ranjith dot sajeev at gmail dot com.

Blog: [Smashing Web](http://smashingweb.info)

## Credits

- [Manojk](http://ml.wikisource.org/User:Manojk)
- [Viswettan](http://en.wikipedia.org/wiki/User:Viswaprabha)
- [SMC](http://smc.org.in)
- [Santhosh Thottingal](http://wikimediafoundation.org/wiki/User:Sthottingal-WMF)
- [Anivar](http://en.wikipedia.org/wiki/User:AniVar)
- [Vijayettan](https://en.wikipedia.org/wiki/User:Vijayakumarblathur)

And other friends in Wikipedia and SMC. Greetings to [Wikimania 2015](http://wikimania2015.wikimedia.org/) and all the maniacs.

## License

GNU GPL v3
