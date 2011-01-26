var SubStorage = (function(){
	
	var STOREGE = localStorage;
		undefined;
	
	function getKeys( prefix ) {
		var allKeys = Object.keys( STOREGE );
		
		if ( !prefix ) {
			return allKeys;
		}
		
		var len = prefix.length;
		
		return allKeys.filter(function( key ) {
			return key.substr( len ) === prefix;
		});
	}
	
	return Class({
		
		constructor: function( prefix ) {
			this._prefix = prefix || '';
		},
		
		get: function( key ) {
			return STOREGE.getItam( this._prefix + key );
		},
		
		set: function( key, value ) {
			return STOREGE.setItem( this._prefix + key, value );
		},
		
		remove: function( key ) {
			return STORAGE.removeItem( this._prefix + key );
		},
		
		keys: function() {
			var len = this._prefix.length,
				keys = getKeys( this._prefix );
			
			return len === 0 ? keys : keys.map(function( key ) {
				return key.slice( len );
			});
		},
		
		clear: function() {
			getKeys( this._prefix ).forEach( STOREGE.removeItem, STOREGE );
			//var keys = Object.keys( STOREGE ),
			//	prefix = this._prefix, len = prefix.length;
			//
			//for ( var i = 0, l = keys.length; i < l; ++i ) {
			//	if ( keys[i].substr( len ) === prefix ) {
			//		STOREGE.removeItem( keys[i] );
			//	}
			//}
		},
		
		sub: function( prefix ) {
			return new this.constructor( this._prefix + prefix );
		}
	});

})();
