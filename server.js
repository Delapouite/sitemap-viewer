var fs = require('fs');
var path = require('path');

var request = require('request');
var cheerio = require('cheerio');
var jsonfile = require('jsonfile');
var xml2json = require('xml2json');
var express = require('express');
var mkdirp = require('mkdirp');
var URI = require('URIjs');
var moment = require('moment');
var _ = require('lodash');
var Q = require('q');
var QHTTP = require('q-io/http');

const dbFileName = './db/fr.json';
const MDN = 'https://developer.mozilla.org';
var parserOptions = {
	tags: true,
	locales: true,
	links: true,
	'404': true
};

var db = jsonfile.readFileSync(dbFileName);
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

function dump(uriPath) {
	var uri = MDN + uriPath;
	request({uri: uri}, function(error, response, body) {
		// local save
		mkdirp(__dirname + '/db' + path.dirname(uriPath), function (err) {
			if (err) {
				console.error(err);
			} else {
				fs.writeFile(__dirname + '/db' + uriPath + '.html', body, function(err) {
					if (err) {
						console.log(err);
					} else {
						if (!db[uri]) {
							db[uri] = {};
						}
						db[uri].lastDump = new Date();
					}
				});
			}
		});
		parseBody(body, uri);
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
		'404': 0
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

function parse404($, uri) {
	var promises = [];
	if ($('#wikiArticle a').length) {
		$('#wikiArticle a').each(function() {
			var href = $(this).attr('href');
			if (!href) {
				return;
			}
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

function parseBody(body, uri) {
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
	
	function save() {
		jsonfile.writeFile(dbFileName, db, function(err) {
			if (err) console.log(err);
		});
	}

	if (parserOptions['404']) {
		var promises = parse404($, uri);
		Q.all(promises).then(function(responses) {
			responses.forEach(function(res) {
				if (res.status === 404) {
					console.log('404', res.nodeResponse.req.path);
					db[uri].links['404']++;
				}
				if (res.status === 301) {
					console.log('301', res.nodeResponse.req.path);
				}
			});
			save();
		}, function() {
			console.log('Q error', arguments);
		});
	} else {
		save();
	}
}

function displayDate(date, format) {
	return (date && moment(date).format(format || 'YYYY-MM-DD')) || 'none';
}

app.use(express.static('public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.get('/', function(req, res) {
	fs.readFile('./public/sitemaps/fr.xml', 'utf-8', function(err, sitemap) {
		sitemap = xml2json.toJson(sitemap, {
			object: true,
			reversible: false,
			coerce: true,
			sanitize: false,
			trim: true,
			arrayNotation: false
		});

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
			displayDate: displayDate
		});
	});
});

app.get('/dump', function(req, res) {
	dump(path.normalize(req.query.uriPath));
	res.send(200);
});

app.get('/dump/sitemap', function(req, res) {
	var uri = MDN + '/sitemaps/' + req.query.locale + '/sitemap.xml';
	request({uri: uri}, function(error, response, body) {
		fs.writeFile(__dirname + '/public/sitemaps/' + req.query.locale + '.xml', body, function(err) {
			if (err) {
				console.log(err);
			}
		});
	});
	res.send(200);
});

app.get('/parse', function(req, res) {
	var uriPath = path.normalize(req.query.uriPath);
	fs.readFile(__dirname + '/db' + uriPath + '.html', 'utf-8', function(err, data) {
		if (err) {
			console.log(err);
			if (err.code === 'ENOENT') {
				dump(uriPath);
			}
		} else {
			parseBody(data, MDN + uriPath);
		}
	});
	res.send(200);
});

app.listen(3000);
console.log('Listening on port 3000');