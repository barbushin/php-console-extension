document.addEventListener('DOMContentLoaded', function() {
	var tabId = null;
	var domain = null;
	var historyLimit = 20;
	var currentIndex = -1;
	var currentCode = '';
	var codeNode = null;
	var app = chrome.extension.getBackgroundPage()['app'];

	function storeCurrentCode(code) {
		currentCode = code;
		var json = localStorage.getItem('evalCurrents');
		var currents = json ? JSON.parse(json) : {};
		currents[domain] = {'code': code, 'pos': codeNode.selectionStart};
		localStorage['evalCurrents'] = JSON.stringify(currents);
	}

	function initCurrentStoredCode() {
		var json = localStorage.getItem('evalCurrents');
		var currents = json ? JSON.parse(json) : {};
		var current = currents[domain] ? currents[domain] : null;
		if(current) {
			currentCode = current['code'];
			codeNode.focus();
			codeNode.value = currentCode;
			codeNode.setSelectionRange(current['pos'], current['pos'])
		}
	}

	function storeCodeInHistory(code) {
		var history = getDomainCodeHistory();
		if(history[0] != code) {
			history.unshift(code);
			if(history.length > historyLimit) {
				history.pop();
			}
		}
		setDomainCodeHistory(history);
		currentIndex = 0;
	}

	function getDomainCodeHistory() {
		var json = localStorage.getItem('evalHistory');
		var history = json ? JSON.parse(json) : {};
		return history[domain] ? history[domain] : [];
	}

	function setDomainCodeHistory(domainHistory) {
		var json = localStorage.getItem('evalHistory');
		var history = json ? JSON.parse(json) : {};
		history[domain] = domainHistory;
		localStorage['evalHistory'] = JSON.stringify(history);
	}

	function getPreviousCode() {
		var history = getDomainCodeHistory();
		if(currentIndex < historyLimit && (currentIndex + 1 < history.length)) {
			currentIndex++;
			return history[currentIndex];
		}
	}

	function getNextCode() {
		var history = getDomainCodeHistory();
		if(currentIndex > 0) {
			currentIndex--;
			return history[currentIndex];
		}
	}

	// construct

	document.getElementById('logoutButton').onclick = function() {
		chrome.extension.sendMessage({
			'_logout': true
		});
		window.close();
	};

	app['getActiveTab'](function(currentTabId, currentDomain) {
		tabId = currentTabId;
		domain = currentDomain;

		codeNode = document.getElementById('code');
		initCurrentStoredCode();

		codeNode.onclick = function() {
			storeCurrentCode(codeNode.value);
		};

		document.onkeyup = function(event) {
			var key = event.keyCode || event.which;
			if(event.ctrlKey) {
				// ctrl + enter
				if(key == 0xA || key == 0xD) {
					if(codeNode.value.trim()) {
						storeCodeInHistory(codeNode.value);
						codeNode.className = 'send';
						chrome.extension.sendMessage({
							'_evalCode': true,
							'code': codeNode.value,
							'tabId': tabId
						}, function() {
							codeNode.className = '';
						});
					}
				}
				// ctrl + page up/down
				else {
					if(key == 38 || key == 40) {
						var code = key == 38 ? getPreviousCode() : getNextCode();
						if(code) {
							codeNode.value = code;
						}
					}
				}
			}
			// tab key
			else {
				if(key == 9) {
					event.preventDefault();
					var unTab = event.shiftKey;
					var code = codeNode.value;
					var start = codeNode.selectionStart;
					var end = codeNode.selectionEnd;
					if((start - end) || unTab) {
						for(var nlPos = start; nlPos; nlPos--) {
							if(code.charAt(nlPos - 1) == "\n") {
								break;
							}
						}
						var newStart = start + (unTab
								? (/^\t/.exec(code.substring(nlPos, end)) ? -1 : 0)
								: 1
							);
						if(newStart < 0) {
							newStart = 0;
						}

						var tabbedCode = unTab
							? code.substring(nlPos, end).replace(/^\t/, '').replace(/\n\t/g, "\n")
							: "\t" + code.substring(nlPos, end).replace(/\n/g, "\n\t");

						codeNode.value = code.substring(0, nlPos)
						+ tabbedCode
						+ code.substring(end);

						codeNode.setSelectionRange(newStart, nlPos + tabbedCode.length);
						codeNode.focus();
					}
					else {
						codeNode.value = code.substring(0, start) + "\t" + code.substring(end);
						codeNode.setSelectionRange(start + 1, start + 1);
					}
				}
				// enter
				else {
					if(key == 0xA || key == 0xD) {
						var code = codeNode.value;
						var start = codeNode.selectionStart;
						var end = codeNode.selectionEnd;
						var tab = code.charAt(start - 2) == '{' ? "\t" : '';
						for(var nlPos = start - 1; nlPos; nlPos--) {
							if(code.charAt(nlPos - 1) == "\n") {
								for(var i = nlPos; code.charAt(i) == "\t"; i++) {
									tab = tab + "\t";
								}
								break;
							}
						}
						if(tab) {
							codeNode.value = code.substring(0, start) + tab + code.substring(end);
							codeNode.setSelectionRange(start + tab.length, start + tab.length);
						}
					}
				}
			}
			storeCurrentCode(codeNode.value);
		};
	});

}, false);
