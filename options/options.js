document.addEventListener('DOMContentLoaded', function() {

	var app = chrome.extension.getBackgroundPage()['app'];
	app['getActiveTab'](function(tabId, domain) {
		var options = app['getOptions']();
		options['getServer'](domain, function(server) {

			var checkboxes = document.querySelectorAll('[type="checkbox"]');
			for(var i = 0; i < checkboxes.length; i++) {
				var checkbox = checkboxes.item(i);
				checkbox.checked = options[checkbox.id] || false;
				checkbox.addEventListener('change', function() {
					options[this.id] = this.checked;
				});
			}

			function getHtml(containerId, item, isSelected) {
				return '<label for="' + containerId + item + '" class="pure-checkbox"><input id="' + containerId + item + '" type="checkbox" ' + (isSelected ? 'checked="checked"' : '') + ' value="' + item + '"> ' + item + '</label>';
			}

			function initList(containerId, optionName, items) {
				var selectedItems = server[optionName];
				var html = '';
				for(var item in selectedItems) {
					html = html + getHtml(containerId, item, selectedItems[item]);
				}
				for(var i in items) {
					if(typeof selectedItems[item] == 'undefined') {
						html = html + getHtml(containerId, items[i], selectedItems[item]);
					}
				}
				document.getElementById(containerId).innerHTML = html;

				var checkboxes = document.querySelectorAll('#' + containerId + ' [type="checkbox"]');
				for(var i = 0; i < checkboxes.length; i++) {
					var checkbox = checkboxes.item(i);
					// save list option
					checkbox.addEventListener('change', function() {
						var checked = [];
						var unchecked = [];
						var opt = {};
						opt[optionName] = {};
						for(var ii = 0; ii < checkboxes.length; ii++) {
							var ch = checkboxes.item(ii);
							ch.checked ? checked.push(ch.value) : unchecked.push(ch.value);
						}
						checked.sort();
						unchecked.sort();
						for(var ii in checked) {
							opt[optionName][checked[ii]] = true;
						}
						for(var ii in unchecked) {
							opt[optionName][unchecked[ii]] = false;
						}
						options['updateServer'](domain, opt);
					});
				}
			}

			var lifeTimeSelect = document.getElementById('notifyLifeTime');
			for(var i in lifeTimeSelect.options) {
				if(lifeTimeSelect.options[i].value == options['notifyLifeTime']) {
					lifeTimeSelect.selectedIndex = i;
				}
			}
			lifeTimeSelect.addEventListener('change', function() {
				options['notifyLifeTime'] = lifeTimeSelect.item(lifeTimeSelect.selectedIndex).value;
			});

			var errors = [
				'E_STRICT',
				'E_DEPRECATED',
				'E_RECOVERABLE_ERROR',
				'E_NOTICE',
				'E_WARNING',
				'E_ERROR',
				'E_PARSE',
				'E_USER_DEPRECATED',
				'E_USER_NOTICE',
				'E_USER_WARNING',
				'E_USER_ERROR',
				'E_CORE_WARNING',
				'E_CORE_ERROR',
				'E_COMPILE_ERROR',
				'E_COMPILE_WARNING'
			];

			initList('errorContainer', 'ignoreErrors', errors);
			initList('debugContainer', 'ignoreDebug', []);

		});
	});
});
