/* global require */
var request = require('request');
var cheerio = require('cheerio');
var jsonfile = require('jsonfile');
var express = require('express');

var dbFileName = './public/db/fr.json';
var db = jsonfile.readFileSync(dbFileName);

var app = express();

app.use(express.static('public'));

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
		if ($('#translations a:contains("English")')) {
			locales['en-US'] = $('#translations a:contains("English")').attr('href').slice(12);
		}
		// dates
		db[uri] = {
			lastEditor: $('#doc-contributors a').last().text(),
			lastUpdated: $('#doc-contributors time').first().attr('datetime'),
			lastDump: new Date(),
			tags: tags,
			locales: locales
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