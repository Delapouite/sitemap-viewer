// collapse rows
document.body.addEventListener('click', function(evt) {
	if(!evt.target.id || evt.target.id.substr(0, 4) !== 'path') {
		return;
	}
	var trs = document.getElementsByClassName(evt.target.id);
	for (var i = 0, tr, display; i < trs.length; i++) {
		tr = trs[i];
		display = window.getComputedStyle(tr, '').getPropertyValue('display');
		tr.style.display = display === 'table-row' ? 'none' : 'table-row';
	}
});

function sendXHR(url, next) {
	var xhr = new XMLHttpRequest();
	xhr.onload = function(evt) {
		if (next) {
			next(JSON.parse(this.responseText));
		}
	};
	xhr.open('GET', url);
	xhr.send(null);
}

function displayTags(tags) {
	var HTML = '';
	tags.forEach(function(tag) {
		HTML += '<a href="#tag-' + tag + '">' + tag + '</a> ';
	});
	return HTML;
}

function displayLinks(links) {
	var HTML = '';
	if (links.external)
		HTML += '<span>ext: ' + links.external + '</span>';
	if (links.fr)
		HTML += '<span>fr: ' + links.fr + '</span>';
	if (links['en-US'])
		HTML += '<span>en-US: ' + links['en-US'] + '</span>';
	if (links['404'])
		HTML += '<span class="d05">404: ' + links['404'] + '</span>';
	if (links['301'])
		HTML += '<span class="d10">301: ' + links['301'] + '</span>';
	return HTML;
}

function remoteAction(evt, action) {
	var target = evt.target;
	if(!target.classList.contains(action)) {
		return;
	}
	target.style.color = 'green';
	target.textContent = 'dumping...';
	// update line TODO turn this into a proper template
	sendXHR('/' + action + '?uriPath=' + target.dataset.uriPath, function(res) {
		var tr = target.parentNode.parentNode;
		tr.style.backgroundColor = 'rgb(252, 247, 215)';
		// last updated
		tr.querySelector('.lastUpdated').style.color = 'green';
		tr.querySelector('.lastUpdated').textContent = res.lastUpdated.substr(0, 10);
		// dump button
		target.style.color = 'green';
		target.textContent = res.lastDump.substr(0, 10);
		// parse button
		tr.querySelector('.parse').style.color = 'green';
		tr.querySelector('.parse').textContent = res.lastDump.substr(0, 10);
		// tags
		tr.querySelector('.tags').innerHTML = displayTags(res.tags);
		// locales
		if (res.locales && res.locales['en-US']) {
			tr.querySelector('.locales').innerHTML = '<a rel="nofollow" href="' + MDN + '/en-US/docs/' + res.locales['en-US'] + '">' + res.locales['en-US'] + '</a>';
		}
		// links
		tr.querySelector('.links').innerHTML = displayLinks(res.links);
		// content length
		tr.querySelector('.contentLength').textContent = res.contentLength;
		// last editor
		tr.querySelector('.lastEditor').textContent = res.lastEditor;
	});
}

// dump buttons
document.body.addEventListener('click', function(evt) {
	remoteAction(evt, 'dump');
});

// parse buttons
document.body.addEventListener('click', function(evt) {
	remoteAction(evt, 'parse');
});

// parse checkboxes
document.getElementById('parserOptions').addEventListener('click', function(evt) {
	if(evt.target.tagName.toLowerCase() === 'input') {
		sendXHR('GET', '/options?option=' + evt.target.name.substr(6) + '&enabled=' + evt.target.checked);
	}
});