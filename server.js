var fs = require('fs');
var path = require('path');

var request = require('request');
var cheerio = require('cheerio');
var jsonfile = require('jsonfile');
var xml2json = require('xml2json');
var express = require('express');
var mkdirp = require('mkdirp');
var _ = require('lodash');

var dbFileName = './db/fr.json';
var db = jsonfile.readFileSync(dbFileName);
const MDN = 'https://developer.mozilla.org';

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

function dump(uriPath) {
	var uri = MDN + uriPath;
	request({uri: uri}, function(error, response, body) {
		// local save
		mkdirp(__dirname + '/db' + path.dirname(uriPath), function (err) {
			if (err) {
				console.error(err);
			} else {
				fs.writeFile(__dirname + '/db' + uriPath, body, function(err) {
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

function parseBody(body, uri) {
	var $ = cheerio.load(body);
	// tags
	var tags = [];
	$('.tagit-label').each(function() {
		tags.push($(this).text());
	});
	//locales
	var locales = {};
	if ($('#translations a:contains("English")').length) {
		locales['en-US'] = $('#translations a:contains("English")').attr('href').slice(12);
	}
	// links
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
			} else if(href.substring(0, 3) === '/fr') {
				links.fr++
			} else if(href.substring(0, 6) === '/en-US') {
				links['en-US']++;
			}
		});
	}

	// dates
	db[uri].lastEditor = $('#doc-contributors a').last().text();
	db[uri].lastUpdated = $('#doc-contributors time').first().attr('datetime');
	db[uri].lastParsed = new Date();

	db[uri].contentLength = $('#wikiArticle').text().trim().length;

	db[uri].tags = tags;
	db[uri].locales = locales;
	db[uri].links = links;

	// save
	jsonfile.writeFile(dbFileName, db, function(err) {
		if (err) console.log(err);
	});
}

app.use(express.static('public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.get('/', function(req, res) {
	fs.readFile('./public/sitemaps/fr.xml', 'utf-8', function(err, sitemap) {
		res.render('index', {
			db: db,
			sitemap: xml2json.toJson(sitemap, {
				object: true,
				reversible: false,
				coerce: true,
				sanitize: false,
				trim: true,
				arrayNotation: false
			}),
			tags: getTags(db)
		});
	});
});

app.get('/dump', function(req, res) {
	dump(path.normalize(req.query.uriPath));
	res.send(200);
});

app.get('/parse', function(req, res) {
	var uriPath = path.normalize(req.query.uriPath);
	fs.readFile(__dirname + '/db' + uriPath, 'utf-8', function(err, data) {
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