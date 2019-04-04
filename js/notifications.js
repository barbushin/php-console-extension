function NotificationsHandler(options) {

	var lastClearTime = null;
	var timeOut = null;
	var notifies = {};
	var index = 1;

	var typesIcons = {
		'update': 'ok.png',
		'js_error': 'js_error.png',
		'error': 'error.png',
		'ahtung': 'ahtung.png',
		'debug': 'info.png'
	};
	var self = this;

	function getMessageString(message, tab) {
		tab = tab || '';
		if(typeof message == 'object' && message !== null) {
			var result = '';
			for(var i in message) {
				var item = '';
				if(typeof message[i] == 'object' && message[i] !== null) {
					item = getMessageString(message[i], tab + "  ");
					item = item ? "\n" + item : (i.indexOf(':') != -1 ? '{}' : '[]');
				}
				else {
					item = message[i] + "\n";
				}
				result = result + tab + i + ': ' + item;
			}
			return result;
		}
		else {
			return tab + message + "\n";
		}
	}

	chrome.extension.onRequest.addListener(function(request) {
		if(request['showNotifications']) {
			self.showNotifications(request['showNotifications']);
		}
		else if(request['showNotification']) {
			self.showNotification(request['message']);
		}
	});

	function getClipboardText(obj, message) {
		if(message['type'] == 'debug') {
			return obj['message'];
		}
		var text = obj['title'] + ': ' + obj['message'];
		if(message['path']) {
			text += '\n' + message['path'] + (message['line'] ? ':' + message['line'] : '');
		}
		if(message['trace']) {
			text += '\n' + message['trace'];
		}
		return text;
	}

	function displayNotification(message, callback) {
		index++;
		var id = 'n' + index;
		var obj = {
			'type': 'basic',
			'buttons': [],
			'priority': message['type'] == 'error' ? 2 : 0,
			'iconUrl': typesIcons[message['type']] ? ('img/' + typesIcons[message['type']]) : null,
			'title': message['subject'] ? message['subject'] : (message['type'] == 'debug' ? message['tags'].join('.') : message['class']),
			'message': getMessageString(message['data']).trim()
		};

		var notify = {
			'isPermanent': message['permanent'] || false,
			'openUrlOnClose': message['openUrlOnClose'] || null,
			'buttons': []
		};

		if(message['path']) {
			var maxLen = 50;
			var open = options['notifyJumpToFile'] && message['isLocal'] && message['type'] != 'eval_result' && message['line'];
			var source = message['path'] + (message['line'] ? ' ' + message['line'] : '');
			obj['buttons'].push({
				'title': source.length <= maxLen ? source : ('...' + source.substr(-(maxLen - 3))),
				'iconUrl': open ? 'img/jump.png' : 'img/file.png'
			});
			notify.buttons.push({
				'type': 'source',
				'open': open,
				'file': message['file'],
				'line': message['line'],
				'tabId': message['tabId']
			});
		}

		if(options['notifyCopyToClipboard'] && (message['type'] == 'error' || message['type'] == 'js_error' || message['type'] == 'debug')) {
			obj['buttons'].push({
				'title': 'Copy to clipboard',
				'iconUrl': 'img/clipboard.png'
			});
			notify.buttons.push({
				'type': 'copy',
				'text': getClipboardText(obj, message)
			});
		}

		if(message['buttons']) {
			for(var i in message['buttons']) {
				var button = message['buttons'][i];
				obj['buttons'].push({
					'title': button['title'],
					'iconUrl': button['icon'] || null
				});
				notify.buttons.push({
					'type': 'link',
					'url': button['url']
				});
			}
		}

		notifies[id] = notify;

		if(notify['isPermanent']) {
			setTimeout(function() {
				if(notifies[id]) {
					checkOpenUrlOnClose(id);
					closeNotification(id, true);
				}
			}, 30000);
		}

		//noinspection JSCheckFunctionSignatures
		chrome.notifications.create(id, obj, callback);
	}

	function startTimeout() {
		if(!timeOut && options['notifyLifeTime']) {
			timeOut = setTimeout(function() {
				closeNotification();
				timeOut = null;
				if(Object.keys(notifies).length) {
					startTimeout();
				}
			}, options['notifyLifeTime'] * 1000);
		}
	}

	function closeNotification(id, force) {
		if(!id) {
			//noinspection LoopStatementThatDoesntLoopJS
			for(var i in notifies) {
				id = i;
				break;
			}
		}
		if(id && (!notifies[id]['permanent'] || force)) {
			delete notifies[id];
			chrome.notifications.clear(id, function() {
			});
		}
	}

	self.showNotifications = function(messages, noClearPrevious) {
		if(!noClearPrevious) {
			clearNotifications();
		}
		popAndShow(messages);
		startTimeout();
	};

	function popAndShow(messages) {
		var m = messages.shift();
		m && displayNotification(m, function() {
			popAndShow(messages);
		});
	}

	self.showNotification = function(message, noClearPrevious) {
		self.showNotifications([ message ], noClearPrevious);
	};

	function clearNotifications() {
		var ids = Object.keys(notifies);
		if(new Date().getTime() - lastClearTime > 500) {
			for(var i in ids) {
				closeNotification(ids[i]);
			}
		}
		lastClearTime = new Date().getTime();
		if(timeOut) {
			clearTimeout(timeOut);
			timeOut = null;
		}
	}

	chrome.notifications.onClosed.addListener(function(id, byUser) {
		if(notifies[id]) {
			checkOpenUrlOnClose(id);
		}
		if(byUser) {
			clearNotifications();
		}
	});

	function checkOpenUrlOnClose(id) {
		if(notifies[id]['openUrlOnClose']) {
			chrome.tabs.create({
				url: notifies[id]['openUrlOnClose'],
				active: true
			});
		}
	}

	chrome.notifications.onClicked.addListener(function(id) {
		if(notifies[id]) {
			checkOpenUrlOnClose(id);
			delete notifies[id];
		}
	});

	chrome.notifications.onButtonClicked.addListener(function(id, buttonIndex) {
		if(notifies[id]) {
			var button = notifies[id]['buttons'][buttonIndex];
			if(button['type'] == 'link') {
				chrome.tabs.create({
					'url': button['url'],
					'active': true
				});
			}
			else if(button['type'] == 'source') {
				if(/:\/\//.exec(button['file'])) { // TODO: LOW fix for local JS with disabled Jump to source
					chrome.tabs.create({
						'url': 'view-source:' + button['file'],
						'active': true
					});
				}
				else if(button['open']) {
					document.getElementById('debug').setAttribute('src', 'editor://open/?file=' + encodeURIComponent(button['file']) + '&line=' + encodeURIComponent(button['line']));
				}
			}
			else if(button['type'] == 'copy') {
				var textareaNode = document.getElementById('textarea');
				textareaNode.value = button['text'];
				textareaNode.select();
				document.execCommand('Copy', false, null);
			}
			delete notifies[id];
		}
	});
}
