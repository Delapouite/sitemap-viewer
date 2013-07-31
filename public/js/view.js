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

function remoteAction(evt, action) {
	if(!evt.target.classList.contains(action)) {
		return;
	}
	evt.target.style.color = 'green';
	evt.target.textContent = 'today';
	var xhr = new XMLHttpRequest();
	xhr.open('GET', '/' + action + '?uriPath=' + evt.target.dataset.uriPath);
	xhr.send(null);
}

// dump buttons
document.body.addEventListener('click', function(evt) {
	remoteAction(evt, 'dump');
});

// parse buttons
document.body.addEventListener('click', function(evt) {
	remoteAction(evt, 'parse');
});