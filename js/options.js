function Options(callback) {

	var self = this;

	this.protocol = 5;

	var options = {
		'version': null,
		'consoleDebug': true,
		'consoleErrors': true,
		'consoleCollapseNoErrors': false,
		'notifyDebug': true,
		'notifyErrors': true,
		'notifyJavaScriptErrors': true,
		'notifyLifeTime': '',
		'notifyCopyToClipboard': false,
		'notifyJumpToFile': false,
		'evalClearConsole': true,
		'evalShowTime': true
	};

	function storeSet(option, value) {
		localStorage[option] = typeof value == 'object' ? JSON.stringify(value) : value;
	}

	function storeGet(option) {
		var value = localStorage.getItem(option);
		if(value == 'true') {
			return true;
		}
		if(value == 'false') {
			return false;
		}
		if(value !== null && value.charAt(0) == '{' && value.charAt(value.length - 1) == '}') {
			return JSON.parse(value);
		}
		return value;
	}

	function getterFunc(option) {
		return function() {
			return options[option];
		};
	}

	function setterFunc(option) {
		return function(value) {
			options[option] = value;
			storeSet(option, value);
		};
	}

	function initDefaultOptions() {
		// flush old settings
		if(typeof localStorage['evalShowTime'] == 'undefined') {
			for(var i in localStorage) {
				if(i != 'version') {
					delete localStorage[i];
				}
			}
		}

		for(var option in options) {
			var value = storeGet(option);
			if(value === null) {
				value = options[option];
				storeSet(option, value);
			}
			else {
				options[option] = value;
			}
			self.__defineGetter__(option, getterFunc(option));
			self.__defineSetter__(option, setterFunc(option));
		}
	}

	var serverOptionsDefaults = {
		'auth': {},
		'ignoreErrors': {},
		'ignoreDebug': {}
	};

	var db = null;
	var dbName = 'php-console';
	var serversTable = 'servers';
	var serversIndex = 'domain';

	// servers options

	function getServerStore() {
		return db.transaction(serversTable, 'readwrite').objectStore(serversTable);
	}

	this['getServer'] = function(domain, callback, store) {
		(store || getServerStore()).index(serversIndex).get(domain).onsuccess = function(event) {
			var obj = event.target.result || {};
			obj[serversIndex] = domain;
			for(var i in serverOptionsDefaults) {
				if(typeof obj[i] == 'undefined') {
					obj[i] = serverOptionsDefaults[i];
				}
			}
			callback(obj);
		};
	};

	this['updateServer'] = function(domain, newData, callback, recursiveMerge) {
		var store = getServerStore();
		self['getServer'](domain, function(oldData) {
			for(var i in newData) {
				if(recursiveMerge && oldData[i] && typeof newData[i] == 'object') {
					for(var ii in newData[i]) {
						oldData[i][ii] = newData[i][ii];
					}
				}
				else {
					oldData[i] = newData[i];
				}
			}
			var request = store.put(oldData);
			if(callback) {
				request.onsuccess = callback;
			}
		}, store);
	};

	// construct

	var connector = indexedDB.open(dbName);
	connector.onupgradeneeded = function() {
		db = connector.result;
		db.createObjectStore(serversTable, {keyPath: serversIndex, autoIncrement: false})
			.createIndex(serversIndex, serversIndex, {unique: true});
	};
	connector.onsuccess = function() {
		db = connector.result;
		initDefaultOptions();
		callback(self);
	};

}
