function MessagesHandler(options, auth, notificationsHandler, app) {

	this.domainsSsl = {};
	this.tabsUrls = {};
	var domainsDocRoots = {};
	var domainsBasePaths = {};
	var domainsIsLocal = {};
	var slashRegExp = new RegExp('\\\\', 'g');
	var urlDomainRegexp = new RegExp(':\/\/([^:/]+)');
	var ipV6UrlRegexp = new RegExp(':\/\/(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))');
	var ipV4Regexp = new RegExp('^[\\d]+\\.[\\d]+\\.[\\d]+\\.[\\d]+$');
	var ipV6Regexp = new RegExp('^([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])$');
	var baseDomainRegexp = new RegExp('(^|\\.)([^.]+\\.[\\w]+)$');
	var fileUriRegexp = new RegExp('^\\w+://.*?(/.*\\.(js|htm|html))($|\\?)');
	var self = this;

	this.fixSlashes = function(string) {
		return string.replace(slashRegExp, '/');
	};

	this.updateIcon = function(pack) {
		var tabId = pack['tabId'];
		if(pack['protocol']) {
			var icon = 'logo_16.png';
			var popup = 'options/layout.html';
			var title = 'PHP Console is active on server.';
			if(pack['protocol'] != options['protocol']) {
				icon = 'logo_16_fail.png';
				popup = 'wrong_protocol.html';
				title = 'Wrong version of PHP Console server. Click on this icon to get update instructions.'; // TODO: add open github on click
			}
			/*else if(!options['enabled']) {
			 icon = 'logo_16_grey.png';
			 title = 'PHP Console is disabled on client';
			 }*/
			else if(pack['auth']) {
				if(pack['isEvalEnabled']) {
					icon = 'terminal_16.png';
					title = 'PHP Console eval is enabled on server. Click on this icon to access eval & options form.';
					popup = 'terminal/popup.html';
				}
				else if(pack['auth']['isSuccess']) {
					title = 'PHP Console is active on server protected by password. Click on this icon to see options.';
					popup = 'logout/popup.html';
				}
				else {
					icon = 'key_16.png';
					title = 'PHP Console authorization required. Click on this icon to see authorization form.';
					popup = 'auth/popup.html';
				}
			}
			onTabReady(tabId, function() {
				chrome.pageAction.setTitle({'tabId': tabId, 'title': title});
				chrome.pageAction.setIcon({'tabId': tabId, 'path': 'img/' + icon});
				chrome.pageAction.setPopup({'tabId': tabId, 'popup': popup});
				chrome.pageAction.show(tabId);
			});
		}
		else {
			chrome.pageAction.hide(tabId);
		}
	};

	function onTabReady(tabId, callback) {
		var isReady = false;
		var interval = setInterval(function() {
			chrome.tabs.get(tabId, function(tab) {
				if(tab.status == 'complete' && !isReady && app._tabsIds[tabId]) {
					isReady = true;
					clearInterval(interval);
					callback();
				}
			});
		}, 100);
	}

	function filterIgnoredMessages(messages, server) {
		var ignoreErrors = server['ignoreErrors'];
		var ignoreDebug = server['ignoreDebug'];
		var newDebugTags = {};
		var newMessages = [];
		for(var i in messages) {
			var isIgnored = false;
			var message = messages[i];
			if(message['type'] == 'debug') {
				if(typeof message['tags'] == 'object') {
					for(var ii in message['tags']) {
						var tag = message['tags'][ii];
						if(typeof ignoreDebug[tag] != 'undefined') {
							if(ignoreDebug[tag]) {
								isIgnored = true;
								break;
							}
						}
						else if(!newDebugTags[tag]) {
							newDebugTags[tag] = true;
						}
					}
				}
			}
			else if(message['type'] == 'error' && ignoreErrors[message['class']]) {
				isIgnored = true;
			}
			if(!isIgnored) {
				newMessages.push(message);
			}
		}

		var newTags = Object.keys(newDebugTags);
		if(newTags.length) {
			newTags.sort();
			var newIgnoreDebug = {};
			var checkedTags = [];
			var uncheckedTags = [];
			for(var tag in ignoreDebug) {
				ignoreDebug[tag] ? checkedTags.push(tag) : uncheckedTags.push(tag);
			}
			var tag = null;
			for(var i = 0; i < 20; i++) {
				if(tag = checkedTags.shift()) {
					newIgnoreDebug[tag] = true;
				}
				else if(tag = newTags.shift() || uncheckedTags.shift()) {
					newIgnoreDebug[tag] = false;
				}
				else {
					break;
				}
			}
			options['updateServer'](server['domain'], {'ignoreDebug': newIgnoreDebug});
		}
		return newMessages;
	}

	self.handleMessagesPack = function(packs) {
		var consolePacks = [];
		var lastPack = packs[packs.length - 1];
		if(typeof lastPack['isSslOnlyMode'] != 'undefined') {
			self.domainsSsl[lastPack['domain']] = lastPack['isSslOnlyMode'];
		}
		self.tabsUrls[lastPack['tabId']] = lastPack['url'];
		self.updateIcon(lastPack);

		if(lastPack['protocol'] != options['protocol']) {
			return;
		}

		auth.handleServerAuth(lastPack);

		if(lastPack['docRoot']) {
			domainsDocRoots[lastPack['domain']] = self.fixSlashes(lastPack['docRoot']);
		}
		if(lastPack['sourcesBasePath']) {
			domainsBasePaths[lastPack['domain']] = self.fixSlashes(lastPack['sourcesBasePath']);
		}
		if(lastPack['isLocal']) {
			domainsIsLocal[lastPack['domain']] = lastPack['isLocal'];
		}

		options['getServer'](lastPack['domain'], function(server) {
			for(var s in packs) {
				var pack = packs[s];
				if(pack['messages']) {
					var messages = filterIgnoredMessages(pack['messages'], server);

					var consoleMessages = [];
					var notifyMessages = [];
					var errorInPack = false;
					var evalInPack = false;

					for(var i in messages) {
						var message = messages[i];
						prepareMessageData(message);
						var sendToConsole = message['type'] == 'eval_result';
						sendToConsole |= options['consoleErrors'] && message['type'] == 'error';
						sendToConsole |= options['consoleDebug'] && message['type'] == 'debug';
						if(sendToConsole) {
							if(message['type'] == 'error') {
								errorInPack = true;
							}
							else if(message['type'] == 'eval_result') {
								evalInPack = true;
							}
							handleConsoleMessageBeforeSend(message);
							consoleMessages.push(message);
						}

						var sendToNotifications = false;
						sendToNotifications |= options['notifyErrors'] && message['type'] == 'error';
						sendToNotifications |= options['notifyDebug'] && message['type'] == 'debug';
						sendToNotifications |= message['type'] == 'protocol_error';
						if(sendToNotifications) {
							notifyMessages.push(message);
						}
					}
					// send to console
					if(consoleMessages.length) {
						var orderedMessages = [];
						if(evalInPack) {
							var types = ['debug', 'eval_result', 'error'];
							for(var i in types) {
								for(var ii in consoleMessages) {
									if(consoleMessages[ii]['type'] == types[i]) {
										orderedMessages.push(consoleMessages[ii]);
									}
								}
							}
						}
						consolePacks.push({
							'url': pack['url'],
							'redirectUrl': pack['redirectUrl'],
							'groupName': pack['redirectUrl'] ? pack['url'] + ' --> ' + pack['redirectUrl'] : pack['url'],
							'collapse': !evalInPack && !errorInPack && (pack['redirectUrl'] || options['consoleCollapseNoErrors']),
							'messages': orderedMessages.length ? orderedMessages : consoleMessages
						});
					}

					// notify
					if(notifyMessages.length && !evalInPack) {
						var orderedMessages = [];
						for(var i in notifyMessages) {
							if(notifyMessages[i]['type'] == 'error') {
								orderedMessages.push(notifyMessages[i]);
								delete notifyMessages[i];
							}
						}
						for(var i in notifyMessages) {
							if(notifyMessages[i]['type'] != 'error') {
								orderedMessages.push(notifyMessages[i]);
							}
						}
						notificationsHandler.showNotifications(orderedMessages);
					}
				}
			}

			if(consolePacks.length) {
				onTabReady(lastPack['tabId'], function() {
					app.sendConsoleMessage(lastPack['tabId'], {
						'_handleConsolePacks': true,
						'packs': consolePacks
					});
				});
			}
		});
	};

	function handleConsoleMessageBeforeSend(message) {
		if(message['type'] == 'eval_result') {
			var css = 'color: white; background: black';
			var args = [];
			if(message['output']) {
				args.push(['%c output ', css, message['output']]);
			}
			args.push(['%c return ', css, message['return']]);
			if(message['time'] && options['evalShowTime']) {
				args.push(['%c time ', css, message['time']]);
			}
		}
		else {
			var args = ['%c ' + message['tags'].join('.') + ' ', 'color: white; background: ' + (message['type'] == 'debug' ? 'blue' : 'red'), message['data']];
			if(message['path'] || message['trace']) {
				args.push('-');
				if(message['path']) {
					args.push(message['path'] + (message['line'] ? ':' + message['line'] : ''));
				}
				if(message['trace']) {
					args.push('\n' + message['trace']);
				}
			}
		}
		message['args'] = args;
	}

	function prepareMessageData(message) {
		if(message['trace']) {
			var calls = [];
			for(var i in message['trace']) {
				var call = '#' + (+i + 1) + ' ';
				var trace = message['trace'][i];
				if(trace['file']) {
					call += stripBasePath(message['basePath'], trace['file']);
					if(trace['line']) {
						call += ':' + trace['line'];
					}
				}
				else {
					call += '[internal call]';
				}
				if(trace['call']) {
					call += ' - ' + trace['call'];
				}
				calls.unshift(call);
			}
			message['trace'] = calls.join('\n');
		}
		if(message['file']) {
			message['path'] = stripBasePath(message['basePath'], message['file']);
		}
	}

	function stripBasePath(basePath, file) {
		file = self.fixSlashes(file);
		if(basePath && file.substr(0, basePath.length) == basePath) {
			return file.substr(basePath.length);
		}
		return file;
	}

	//noinspection JSUnusedLocalSymbols
	chrome.extension.onMessage.addListener(function(request, sender) {
		if(request['_handleJavascriptError']) {
			handleJavascriptError(request['text'], request['url'], request['line'], sender.tab.id);
		}
	});

	function handleJavascriptError(text, url, line, tabId) {
		if(!options['notifyJavaScriptErrors']) {
			return;
		}
		if(text) {
			text = text.replace(/^Uncaught /g, '');
			var m = new RegExp('(.+): *(.+)').exec(text);
			if(m) {
				var subject = 'JavaScript ' + m[1];
				text = m[2];
			}
			else {
				var subject = 'JavaScript error';
			}
		}
		else {
			text = '... see details in JavaScript Console';
			var subject = 'JavaScript unknown error';
		}

		var isLocal = false;
		var path = url;

		if(path) {
			var domain = self.getUrlDomain(url);
			var m = fileUriRegexp.exec(url);
			if(m && domainsDocRoots[domain]) {
				url = domainsDocRoots[domain] + m[1];
				isLocal = domainsIsLocal[domain];
				if(domainsBasePaths[domain]) {
					path = stripBasePath(domainsBasePaths[domain], url);
				}
			}
		}

		var message = {
			'tabId': tabId,
			'type': 'js_error',
			'subject': subject,
			'data': text,
			'file': url,
			'line': line,
			'path': path,
			'isLocal': isLocal
		};

		notificationsHandler.showNotification(message, true);
	}

	this.getUrlDomain = function(url) {
		var m = ipV6UrlRegexp.exec(url);
		return m ? m[1] : urlDomainRegexp.exec(url)[1];
	};

	this.getBaseDomain = function(domain) {
		var m = ipV4Regexp.exec(domain);
		if(m) {
			return m[0];
		}
		var m = ipV6Regexp.exec(domain);
		if(m) {
			return m[0];
		}
		var m = baseDomainRegexp.exec(domain);
		return m ? m[2] : domain;
	};

}
