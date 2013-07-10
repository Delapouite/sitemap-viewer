/* global require */
var request = require('request');
var cheerio = require('cheerio');
var jsonfile = require('jsonfile');
var dbFileName = './db/fr.json';
var db = jsonfile.readFileSync(dbFileName);
var express = require('express');
var app = express();

app.use(express.static('public'));

app.get('/dump', function(req, res) {
	request({uri: 'http://delapouite.com'}, function(error, response, body) {
		var $ = cheerio.load(body);
		$('a').each(function() {
			var link = $(this);
			db[link] = {
				text: link.text(),
				href: link.attr('href')
			};
		});
		jsonfile.writeFile(dbFileName, db, function(err) {
			if (err) console.log(err);
		});
	});
	res.send(200);
});

app.listen(3000);
console.log('Listening on port 3000');