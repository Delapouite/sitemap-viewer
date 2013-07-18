var fs = require('fs');

var request = require('request');
var cheerio = require('cheerio');
var jsonfile = require('jsonfile');
var xml2json = require('xml2json');
var express = require('express');
var _ = require('lodash');

var dbFileName = './db/fr.json';
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

app.use(express.static('public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.get('/', function(req, res) {
	fs.readFile('./public/sitemaps/fr.xml', 'utf-8', function(err, sitemap) {
		res.render('index', {
			db: db,
			sitemap: xml2json.toJson(sitemap),
			tags: getTags(db)
		});
	});
});

app.get('/dump', function(req, res) {
	var uri = 'https://developer.mozilla.org' + req.query.url;
	request({uri: uri}, function(error, response, body) {
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
		// dates
		db[uri] = {
			lastEditor: $('#doc-contributors a').last().text(),
			lastUpdated: $('#doc-contributors time').first().attr('datetime'),
			lastDump: new Date(),
			tags: tags,
			locales: locales,
			contentLength: $('#wikiArticle').text().trim().length
		};
		// save
		jsonfile.writeFile(dbFileName, db, function(err) {
			if (err) console.log(err);
		});
	});
	res.send(200);
});

app.listen(3000);
console.log('Listening on port 3000');