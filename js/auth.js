function Auth(options) {

	this.handleServerAuth = function(pack) {
		var auth = pack['auth'];
		if(auth) {
			updateDomainAuth(pack['domain'], {
				'publicKey': auth['publicKey'],
				'isSuccess': auth['isSuccess']
			});
		}
	};

	this.getDomainAuth = function(server) {
		var auth = server['auth'];
		if(auth['publicKey'] && auth['hash']) {
			return new DomainAuth(server['domain'], auth['publicKey'], auth['hash']);
		}
	};

	function updateDomainAuth(domain, newAuth) {
		options['updateServer'](domain, {'auth': newAuth}, null, true);
	}

	function getPasswordHash(password) {
		return window['CryptoJS']['SHA256'](password + 'NeverChangeIt:)').toString();
	}

	this.storePassword = function(domain, password) {
		updateDomainAuth(domain, {'hash': getPasswordHash(password)});
	};

	this.deletePassword = function(domain) {
		updateDomainAuth(domain, {'hash': null});
	};
}

/**
 * @constructor
 */
function DomainAuth(domain, publicKey, passwordHash) {

	this.domain = domain;
	this.publicKey = publicKey;
	this.hash = passwordHash;

	this.getAuthToken = function() {
		if(this.hash && this.publicKey) {
			return window['CryptoJS']['SHA256'](this.hash + this.publicKey).toString();
		}
	};

	this.getSignature = function(string) {
		if(this.hash && this.publicKey) {
			return window['CryptoJS']['SHA256'](this.hash + this.publicKey + string).toString();
		}
	};

	this.getClientAuth = function() {
		var token = this.getAuthToken();
		if(token && this.publicKey) {
			return {
				'publicKey': this.publicKey,
				'token': token
			}
		}
	};
}
