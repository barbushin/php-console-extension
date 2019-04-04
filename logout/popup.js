document.addEventListener('DOMContentLoaded', function() {
	document.getElementById('logoutButton').onclick = function() {
		chrome.extension.sendMessage({
			'_logout': true
		});
		window.close();
	};
}, false);

