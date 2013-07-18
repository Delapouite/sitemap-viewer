function displayDate(date, format) {
	return (date && moment(date).format(format || 'YYYY-MM-DD')) || 'none';
}

function display(country, db, sitemap) {
	// order paths and urls by alpha
	var locs = {};
	sitemap.urlset.url.forEach(function(url) {
		var uri = new URI(url.loc);
		var path = uri.directory(true);
		if (!locs[path]) {
			locs[path] = [];
		}
		locs[path].push(url.loc);
		uri = URI.decode(uri.href());
		if (!db[uri]) {
			db[uri] = {};
		}
		db[uri].lastmod = url.lastmod;
	});

	var paths = _.sortBy(Object.keys(locs));

	// country header
	var table = $('<table/>');
	table.append('<tr><th colspan="10"><a href="https://developer.mozilla.org/en-US/dashboards/revisions?locale=fr&user=&topic=">Revisions dashboard</a> | <a href="#tags">Tags (' + tags.length + ')</a><th></tr>');
	table.append($('<tr><th colspan="10"><h2>' + country + ' : ' + sitemap.urlset.url.length + ' urls in sitemap, ' + Object.keys(db).length + ' dumped</h2></th></tr>'));
	// fields
	table.append($('<tr><th>lastmod</th><th>Last dump</th><th>Last parsed</th><th>URL</th><th>en-US</th><th>Tags</th><th>Links</th><th>Length</th><th>Last updated</th><th>Last editor</th></tr>'));

	paths.forEach(function(path) {
		var orderedLocs = _.sortBy(locs[path]);
		// path header
		table.append($('<tr><td colspan="10"><h3>' + path + ' (' + orderedLocs.length + ')</h3></td></tr>'));
		orderedLocs.forEach(function(loc) {
			var uri = new URI(loc);
			var savedLoc = db[URI.decode(uri.href())] || {};
			var tr = $('<tr/>');
			tr.append(
				'<td class="lastMod ' + (savedLoc.lastmod < displayDate(savedLoc.lastUpdated) ? 'd05'
										: savedLoc.lastmod > displayDate(savedLoc.lastUpdated) ? 'd11' : '') + '">' + savedLoc.lastmod + '</td>',
				'<td class="lastDump"><a rel="nofollow" href="/dump?uriPath=' + uri.path() + '">' + displayDate(savedLoc.lastDump) + '</a></td>',
				'<td class="lastParsed"><a rel="nofollow" href="/parse?uriPath=' + uri.path() + '">' + displayDate(savedLoc.lastParsed) + '</a></td>',
				'<td class="url"><a rel="nofollow" href="' + uri.href() + '" title="' + uri.filename(true) + '">' + uri.filename(true) + '</a></td>',
				'<td class="locales">' + (savedLoc.locales && savedLoc.locales['en-US'] || '') + '</td>',
				'<td>' + (savedLoc.tags && savedLoc.tags.join(' ') || '') +'</td>',
				'<td class="links">' + (savedLoc.links ? 'Ext: ' + savedLoc.links.external + ', fr: ' + savedLoc.links.fr + ', en-US: ' + savedLoc.links['en-US'] : '') + '</td>',
				'<td>' + (savedLoc.contentLength || '') + '</td>',
				'<td class="lastUpdated d' + displayDate(savedLoc.lastUpdated, 'YY') + '">' + displayDate(savedLoc.lastUpdated) + '</td>',
				'<td>' + (savedLoc.lastEditor || '') + '</td>'
			);
			table.append(tr);
		});
	});
	$('body').append(table);
}

function displayTags(tags) {
	var tagsList = $('<ul id="tags"></ul>');
	tagsList.append('<li><h2>' + tags.length + ' Tags</h2></li>');
	tags.forEach(function(tag) {
		tagsList.append('<li>' + tag[0] + ' - ' + tag[1] + '</li>');
	});
	$('body').append(tagsList);
}

display('fr', db, sitemap);
displayTags(tags);