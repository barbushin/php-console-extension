function getCookie(name) {
	var m = new RegExp(';\\s*' + name + '=(.*?);', 'g').exec(';' + document.cookie + ';');
	return m ? m[1] : null;
}

var serverProtocol = getCookie('php-console-server');
if(!serverProtocol) {
	serverProtocol = getCookie('phpcsls');
}

if(serverProtocol) {
	new function() {
		var id = '';
		var jsLastError = '';
		var jsErrorsCount = 0;

		function onExtensionRequest(request) {
			if(request['_id'] == id) {
				if(request['_handleConsolePacks']) {
					for(var i in request['packs']) {
						handleMessagesPack(request['packs'][i]);
					}
				}
				else if(request['_clearConsole']) {
					console.clear();
				}
			}
		}

		function handleMessagesPack(pack) {
			pack['collapse']
				? console.groupCollapsed(pack['groupName'])
				: console.group(pack['groupName']);
			for(var i in pack['messages']) {
				var message = pack['messages'][i];
				clearObjectPrototype(message['args']);
				if(message['type'] == 'eval_result') {
					for(var ii in message['args']) {
						console.log.apply(console, message['args'][ii]);
					}
				}
				else {
					message['type'] == 'error' ? console.error.apply(console, message['args']) : console.log.apply(console, message['args']);
				}
			}
			console.groupEnd();
		}

		function clearObjectPrototype(v) {
			if(typeof v == 'object' && v) {
				v.__proto__ = null;
				for(var i in v) {
					clearObjectPrototype(v[i])
				}
			}
		}

		function handleJavascriptError(error, url, line) {
			if(error['filename']) {
				url = error['filename'];
			}
			if(typeof error['lineno'] != 'undefined') {
				line = error['lineno'] ? error['lineno'] : 1;
			}
			if(error['target']['chrome'] && !url) {
				return;
			}
			if(error['message']) {
				error = error['message'];
			}
			else if(error['data']) {
				error = error['data'];
			}
			else if(error['target'] && error['target']['src']) { // draft fix of http://code.google.com/p/chromium/issues/detail?id=8939
				url = window.location.href;
				error = 'File not found: ' + error['target']['src'];
			}
			if(typeof(error) != 'string' || error == 'Script error.') {
				error = null;
			}
			var hash = error + url + line;

			if(hash != jsLastError && jsErrorsCount < 10) {
				jsLastError = hash;
				jsErrorsCount++;
				chrome.extension.sendMessage({
					'_handleJavascriptError': true,
					'text': error,
					'url': url,
					'line': line
				});
			}
		}

		// construct

		window.addEventListener('error', handleJavascriptError, false);

		chrome.extension.onMessage.addListener(onExtensionRequest);
		chrome.runtime.sendMessage({
			'_registerTab': true,
			'url': window.location.href,
			'protocol': serverProtocol
		}, function(response) {
			if(response['url']) {
				window.location.href = response['url'];
			}
			id = response['id'];
		});
	};
}
