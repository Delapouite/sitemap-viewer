var currentURL = new URI(location);
var db;
var tags = {};
$.ajax({
	url: '/db/fr.json',
	async: false,
	success: function(result) {
		db = result;
	}
});

function sortByValue(object) {
	var tuples = _.map(object, function (value, key) { return [key, value]; });
	return _.sortBy(tuples, function (tuple) { return tuple[1]; });
}

function displayDate(date, format) {
	return (date && moment(date).format(format || 'YYYY-MM-DD')) || 'none';
}

function display(country) {
	$.ajax({
		url: '/sitemaps/' + country + '.xml',
	}).done(function(xml) {
		// order paths and locs by alpha
		var locs = {},
			lastMods = {};
		$(xml).find('url').each(function() {
			var loc = $(this).find('loc').text();
			var uri = new URI(loc);
			var path = uri.directory(true);
			if (!locs[path]) {
				locs[path] = [];
			}
			locs[path].push(loc);
			lastMods[loc] = $(this).find('lastmod').text();
		});

		var paths = _.sortBy(Object.keys(locs));

		// country header
		var table = $('<table></table>');
		table.append('<tr><th colspan="8"><a href="https://developer.mozilla.org/en-US/dashboards/revisions?locale=fr&user=&topic=">Revisions dashboard</a> | <a href="#tags">Tags</a><th></tr>');
		table.append($('<tr><th colspan="8"><h2>' + country + ' : ' + $(xml).find('url').length + ' urls in sitemap, ' + Object.keys(db).length + ' dumped</h2></th></tr>'));
		// fields
		table.append($('<tr><th>lastmod</th><th>URI</th><th>en-US</th><th>Tags</th><th>Length</th><th>Last updated</th><th>Last editor</th><th>Last dump</th></tr>'));

		paths.forEach(function(path) {
			var orderedLocs = _.sortBy(locs[path]);
			// path header
			table.append($('<tr><td colspan="8"><h3>' + path + ' (' + orderedLocs.length + ')</h3></td></tr>'));
			orderedLocs.forEach(function(loc) {
				var uri = new URI(loc);
				var savedLoc = db[URI.decode(uri.href())] || {};
				var tr = $('<tr></tr>');
				if (savedLoc.tags) {
					savedLoc.tags.forEach(function(tag) {
						if (!tags[tag]) {
							tags[tag] = 0;
						}
						tags[tag]++;
					});
				}
				tr.append(
					'<td class="lastMod ' + (lastMods[loc] < displayDate(savedLoc.lastUpdated) ? 'd05'
										   : lastMods[loc] > displayDate(savedLoc.lastUpdated) ? 'd11' : '') + '">' + lastMods[loc] + '</td>',
					'<td><a rel="nofollow" href="' + loc + '">' + uri.filename(true) + '</a></td>',
					'<td class="locales">' + (savedLoc.locales && savedLoc.locales['en-US'] || '') + '</td>',
					'<td>' + (savedLoc.tags && savedLoc.tags.join(' ') || '') +'</td>',
					'<td>' + (savedLoc.contentLength || '') + '</td>',
					'<td class="lastUpdated d' + displayDate(savedLoc.lastUpdated, 'YY') + '">' + displayDate(savedLoc.lastUpdated) + '</td>',
					'<td>' + (savedLoc.lastEditor || '') + '</td>',
					'<td class="lastDump"><a rel="nofollow" href="/dump?url=' + uri.path() + '">' + displayDate(savedLoc.lastDump) + '</a></td>'
				);
				table.append(tr);
			});
		});
		$('body').append(table);

		var sortedTags = sortByValue(tags);

		var tagsList = $('<ul id="tags"></ul>');
		tagsList.append('<li><h2>' + sortedTags.length + ' Tags</h2></li>');
		sortedTags.forEach(function(tag) {
			tagsList.append('<li>' + tag[0] + ' - ' + tag[1] + '</li>');
		});
		$('body').append(tagsList);
	});
}
display('fr');
// display('en-US');