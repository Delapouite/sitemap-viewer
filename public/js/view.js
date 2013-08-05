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

function remoteAction(evt, action) {
	var target = evt.target;
	if(!target.classList.contains(action)) {
		return;
	}
	target.style.color = 'green';
	target.textContent = 'dumping...';
	// update line
	sendXHR('/' + action + '?uriPath=' + target.dataset.uriPath, function(res) {
		var tr = target.parentNode.parentNode;
		tr.style.backgroundColor = 'rgb(252, 247, 215)';
		// dump button
		target.style.color = 'green';
		target.textContent = 'today';
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