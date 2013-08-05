var cheerio = require('cheerio');
var express = require('express');
var fs = require('fs');
var jsonfile = require('jsonfile');
var mkdirp = require('mkdirp');
var moment = require('moment');
var path = require('path');
var Q = require('q');
var QHTTP = require('q-io/http');
var request = require('request');
var URI = require('URIjs');
var xml2json = require('xml2json');
var _ = require('lodash');

const dbFileName = './db/fr.json';
const errorsDbFileName = './db/errors.fr.json';
const MDN = 'https://developer.mozilla.org';
var parserOptions = {
	tags: true,
	locales: true,
	links: true,
	brokenLinks: true
};

// only parse db and sitemap at server launch
var db = jsonfile.readFileSync(dbFileName);
var errorsDb = jsonfile.readFileSync(errorsDbFileName);
var sitemap = parseSitemap(fs.readFileSync('./public/sitemaps/fr.xml', 'utf-8'));
var app = express();

function sortByValue(object) {
	var tuples = _.map(object, function (value, key) { return [key, value]; });
	return _.sortBy(tuples, function (tuple) { return tuple[1]; });
}

function getTags(db) {
	var tags = {};
	_.forEach(db, function(url) {
		if (url.tags) {
			url.tags.forEach(function(tag) {
				if (!tags[tag]) {
					tags[tag] = 0;
				}
				tags[tag]++;
			});
		}
	});
	return sortByValue(tags);
}

function getUrls(sitemap) {
	// order paths and urls by alpha
	var urls = {};
	sitemap.urlset.url.forEach(function(url) {
		var uri = new URI(url.loc);
		var path = uri.directory(true);
		if (!urls[path]) {
			urls[path] = [];
		}
		urls[path].push(url.loc);
		// add sitemap info to db
		uri = URI.decode(uri.href());
		if (!db[uri]) {
			db[uri] = {};
		}
		db[uri].lastmod = url.lastmod;
	});
	return urls;
}

function dump(uriPath, next) {
	var uri = MDN + uriPath;
	request({uri: uri}, function(error, response, body) {
		// local save
		mkdirp(__dirname + '/db' + path.dirname(uriPath), function (err) {
			if (err) {
				console.error('mkdirp', err);
			} else {
				fs.writeFile(__dirname + '/db' + uriPath + '.html', body, function(err) {
					if (err) {
						console.error('dump write', err);
					} else {
						if (!db[uri]) {
							db[uri] = {};
						}
						db[uri].lastDump = new Date();
					}
				});
			}
		});
		parseBody(body, uri, next);
	});
}

function parseSitemap(XMLSitemap) {
	return xml2json.toJson(XMLSitemap, {
		object: true,
		reversible: false,
		coerce: true,
		sanitize: false,
		trim: true,
		arrayNotation: false
	});
}

function parseTags($) {
	var tags = [];
	$('.tagit-label').each(function() {
		tags.push($(this).text());
	});
	return tags;
}

function parseLocales($) {
	var locales = {};
	if ($('#translations a:contains("English")').length) {
		locales['en-US'] = $('#translations a:contains("English")').attr('href').slice(12);
	}
	return locales;
}

function parseLinks($) {
	var links = {
		external: 0,
		fr: 0,
		'en-US': 0,
		'404': 0,
		'301': 0
	};
	if ($('#wikiArticle a').length) {
		$('#wikiArticle a').each(function() {
			var href = $(this).attr('href');
			// compatibily table for example
			if (!href) {
				return;
			}
			// internal
			if (href.substring(0, 7) === 'http://' || href.substring(0, 7) === 'https://') {
				links.external++;
			} else if (href.substring(0, 3) === '/fr') {
				links.fr++;
			} else if (href.substring(0, 6) === '/en-US') {
				links['en-US']++;
			}
		});
	}
	return links;
}

function parseBrokenLinks($, uri) {
	var promises = [],
		hrefs = {};
	if ($('#wikiArticle a').length) {
		$('#wikiArticle a').each(function() {
			var href = $(this).attr('href');
			if (!href) {
				return;
			}
			// only once
			if (hrefs[href]) {
				return;
			}
			hrefs[href] = true;
			if (href.substring(0, 3) === '/fr') {
				promises.push(QHTTP.request(MDN + href));
			}
			// relative links
			if (href.substring(0, 3) === 'fr/') {
				promises.push(QHTTP.request(path.dirname(uri) + '/' + href));
			}
		});
	}
	return promises;
}

function parseBody(body, uri, next) {
	var $ = cheerio.load(body);

	// meta
	if (parserOptions.tags) {
		db[uri].tags = parseTags($);
	}
	if (parserOptions.locales) {
		db[uri].locales = parseLocales($);
	}

	// dates
	db[uri].lastEditor = $('#doc-contributors a').last().text();
	db[uri].lastUpdated = $('#doc-contributors time').first().attr('datetime');
	db[uri].lastParsed = new Date();

	// content
	db[uri].contentLength = $('#wikiArticle').text().trim().length;

	// links
	if (parserOptions.links) {
		db[uri].links = parseLinks($);
	}

	function save(uri) {
		jsonfile.writeFile(dbFileName, db, function(err) {
			if (err) console.error('json write', err);
			next(db[uri]);
		});
		jsonfile.writeFile(errorsDbFileName, errorsDb, function(err) {
			if (err) console.error('json write', err);
		});
	}

	if (parserOptions.brokenLinks) {
		var promises = parseBrokenLinks($, uri);
		Q.all(promises).then(function(responses) {
			errorsDb[uri] = {404: [], 301: []};
			responses.forEach(function(res) {
				if (res.status === 404 || res.status === 301) {
					console.log(res.status, res.nodeResponse.req.path);
					db[uri].links[res.status]++;
					errorsDb[uri][res.status].push(res.nodeResponse.req.path);
				}
			});
			save(uri);
		}, function() {
			console.error('Q', arguments);
		});
	} else {
		save(uri);
	}
}

function displayDate(date, format) {
	return (date && moment(date).format(format || 'YYYY-MM-DD')) || 'none';
}

app.use(express.static('public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.get('/', function(req, res) {
	var urls = getUrls(sitemap);
	res.render('index', {
		URI: URI,
		_ : _,
		MDN: MDN,
		db: db,
		tags: getTags(db),
		sitemap: sitemap,
		urls: urls,
		paths: _.sortBy(Object.keys(urls)),
		displayDate: displayDate,
		parserOptions: parserOptions
	});
});

app.get('/dump', function(req, res) {
	var next = function(saved) {
		res.send(saved);
	};
	dump(path.normalize(req.query.uriPath), next);
});

app.get('/dump/sitemap', function(req, res) {
	var uri = MDN + '/sitemaps/' + req.query.locale + '/sitemap.xml';
	request({uri: uri}, function(error, response, body) {
		fs.writeFile(__dirname + '/public/sitemaps/' + req.query.locale + '.xml', body, function(err) {
			if (err) {
				return console.error('dump sitemap', err);
			}
			sitemap = parseSitemap(body);
		});
	});
	res.send(200);
});

app.get('/parse', function(req, res) {
	var uriPath = path.normalize(req.query.uriPath),
		next = function(saved) {
			res.send(saved);
		}
	fs.readFile(__dirname + '/db' + uriPath + '.html', 'utf-8', function(err, data) {
		if (err) {
			console.error('parse read', err);
			if (err.code === 'ENOENT') {
				dump(uriPath, next);
			}
		} else {
			parseBody(data, MDN + uriPath, next);
		}
	});
});

app.get('/options', function(req, res) {
	if (parserOptions[req.query.option] !== undefined) {
		parserOptions[req.query.option] = req.query.enabled === 'true';
	}
	res.send(200);
});

app.listen(3000);
console.log('Listening on port 3000');