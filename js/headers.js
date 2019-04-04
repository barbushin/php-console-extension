function HeadersHandler(messagesHandler) {

	var self = this;
	var lastDomainsUrls = {};
	var packageHeader = 'PHP-Console';
	var packageHeader2 = 'php-console';
	var postponeHeader = 'PHP-Console-Postpone';
	var postponeHeader2 = 'php-console-postpone';
	var evalFile = new RegExp('EvalProvider\.php.*?eval', 'i');
    var ipRegexp = new RegExp('^[\\d]+\\.[\\d]+\\.[\\d]+\\.[\\d]+$');
	var isUrlRegexp = new RegExp('^http', 'i');
	var baseUrlRegexp = new RegExp('^(.+[/\\\\])');
	var packsQueue = [];

	function getHeaderValue(responseHeaders, headerName, headerName2) {
		for(var i in responseHeaders) {
			if(responseHeaders[i]['name'] === headerName || responseHeaders[i]['name'] === headerName2) {
				return responseHeaders[i]['value'];
			}
		}
		return null;
	}

	function handleResponsePackage(pack, headerPackage, url, tabId, headerLocation) {

		var isPostponed = pack || false;

		if(!isPostponed) {
			pack = {
				'tabId': tabId <= 0 ? null : tabId,
				'redirectUrl': getRedirectUrl(url, headerLocation),
				'url': url,
				'domain': messagesHandler.getUrlDomain(url)
			};
		}

		if(headerPackage) {
			lastDomainsUrls[pack['domain']] = pack['url'];
			var data = JSON.parse(headerPackage);
			if(data['isPostponed']) {
				packsQueue.push(pack);
				getPostponedPack(data['id'], pack);
				return;
			}

			for(var i in data) {
				pack[i] = data[i];
			}
			if(data['getBackData'] && data['getBackData']['tabId']) {
				pack['tabId'] = +data['getBackData']['tabId'];
			}
			if(pack['sourcesBasePath']) {
				pack['sourcesBasePath'] = messagesHandler.fixSlashes(pack['sourcesBasePath']);
			}

			if(pack['messages'] && pack['messages'].length) {
				for(var i in pack['messages']) {
					var message = pack['messages'][i];
					message['redirectUrl'] = pack['redirectUrl'];
					message['url'] = pack['url'];
					message['tabId'] = pack['tabId'];
					message['basePath'] = pack['sourcesBasePath'];
					message['isLocal'] = pack['isLocal'];
					if(message['class']) {
						message['tags'] = [message['class']];
					}
					else if(message['type'] == 'debug' && !message['tags']) {
						message['tags'] = ['debug'];
					}
					else if(!message['tags']) {
						message['tags'] = [message['type']];
					}

					if(message['file'] && evalFile.exec(message['file'])) {
						message['file'] = 'terminal';
					}
				}
			}
		}

		if(pack['tabId']) { // TODO: MED check
			chrome.tabs.get(pack['tabId'], function(tab) {
				pack['tabUrl'] = tab.url;
				if(!isPostponed) {
					packsQueue.push(pack);
				}
				if(!pack['redirectUrl']) {
					handleMessagesPacksQueue();
				}
			});
		}
	}

	function getPostponedPack(id, pack) {
		self.sendPostRequest(pack['url'], {
			'__PHP_Console': {
				'getPostponedResponse': id
			}
		}, function(response) {
			handleResponsePackage(pack, response, null, null, null);
		}, null, null);
	}

	function onHeadersReceived(info) {
		var domain = messagesHandler.getUrlDomain(info.url);
		var headerPackage = getHeaderValue(info['responseHeaders'], packageHeader, packageHeader2);
		if(!headerPackage) {
			headerPackage = getHeaderValue(info['responseHeaders'], postponeHeader, postponeHeader2);
		}
		if(lastDomainsUrls[domain] == info.url || headerPackage) {
			handleResponsePackage(null, headerPackage, info.url, info.tabId, info.redirectUrl);
		}
	}

	function handleMessagesPacksQueue() {
        if(packsQueue.length) {
            var packs = packsQueue.slice(0);
            packsQueue = [];
            messagesHandler.handleMessagesPack(packs);
        }
	}

	function getRedirectUrl(url, headerLocation) {
		if(headerLocation && !isUrlRegexp.exec(headerLocation)) {
			headerLocation = (baseUrlRegexp.exec(url) || [url])[0] + headerLocation;
		}
		return headerLocation;
	}

	function buildQuery(obj, prefix) {
		var str = [];
		for(var p in obj) {
			var k = prefix ? prefix + '[' + p + ']' : p, v = obj[p];
			str.push(typeof v == 'object' ?
				buildQuery(v, k) :
				encodeURIComponent(k) + '=' + encodeURIComponent(v));
		}
		return str.join('&');
	}

	this.sendPostRequest = function(url, data, successCallback, failCallback) {
		try {
			var xhr = new XMLHttpRequest();
			xhr.open('POST', url, true);
			xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
			xhr.onreadystatechange = function() {
				if(xhr.readyState == 4 && xhr.status == 200 && successCallback) {
					successCallback(xhr.responseText);
				}
			};
			xhr.send(buildQuery(data));
		}
		catch (e) {
			failCallback && failCallback();
		}
	};

	this.addListener = function(host) {
		if(!ipRegexp.exec(host)) {
			host = '*.' + host;
		}
		var filter = {
			'urls': ['*://' + host + '/*'],
			'types': ['main_frame', 'sub_frame', 'xmlhttprequest', 'other']
		};
		chrome.webRequest.onCompleted.addListener(onHeadersReceived, filter, ['responseHeaders']);
		chrome.webRequest.onBeforeRedirect.addListener(onHeadersReceived, filter, ['responseHeaders']);
	};
}
