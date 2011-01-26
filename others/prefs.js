var prefs = (function(){
	
	var STORAGE = localStorage,
		_prefs = utils.HASH();
		reType = /^(?:string|boolean|number)$/,
		type2ctor = {},
		undefined;
	
	var Pref = Class({
		constructor: function( key, defValue ) {
			this._key = key;
			this._default = this.cast( defValue );
		},
		
		getValue: function() {
			var r = STORAGE.getItem( this._key );
			return r === undefined ? this._default : this.cast( r );
		},
		
		setValue: function( value ) {
			value = this.cast( value );
			STORAGE.setItem( this._key, value );
			return value;
		},
		
		reset: function() {
			STORAGE.removeItem( this._key );
			return this._default;
		}
	});
	
	type2ctor["string"] = Class( Pref, {
		cast: function( x ) {
			return String( x );
		}
	});
	
	type2ctor["boolean"] = Class( Pref, {
		cast: function( x ) {
			return !!x && x !== "false";
		}
	});
	
	type2ctor["number"] = Class( Pref, {
		cast: function( x ) {
			return x * 1;
		}
	});
	
	
	return {
		
		init: function( defaults ) {			
			var value, type, cls;
			
			for ( var name in defaults ) {
				value = defaults[ name ];
				type = typeof value,
				ctor = type2ctor[ type ];
				
				if ( !reType.test( type ) ) {
					throw new TypeError();
				}
				
				_prefs[ name ] = new ctor( 'prefs.' + name, value );
			}
			
			this.onChanged = new Trigger();
		},
		
		get: function( name ) {
			return _prefs[ name ].getValue();
		},
		
		getDefault: function( name ) {
			return _prefs[ name ]._default;
		},
		
		set: function( name, value, dontFire, /* intenrnal */ reset ) {
			var pref = _prefs[ name ], oldValue;
			
			if ( !dontFire ) {
				oldValue = pref.getValue();
			}
			
			value = reset ? pref.reset() : pref.setValue( value );
			
			if ( !dontFire && oldValue !== value ) {
				this.onChanged.fire( this, [ name, oldValue, value ] );
			}
			
			return value;
		},
		
		names: function( prefix ) {
			return Object.keys( _prefs );
		},
		
		reset: function( name, dontFire ) {
			this.set( name, null, dontFire, true );
		},
		
		resetAll: function( dontFire ) {
			for ( var name in _prefs ) {
				this.reset( name, dontFire );
			}
		},
		
		getAll: function() {
			var res = {};
			
			for ( var name in _prefs ) {
				res[ name ] = _prefs[ name ].getValue();
			}
			
			return res;
		},
		
		setAll: function( obj, dontFire ) {
			for ( var name in obj ) {
				this.set( name, obj[name], dontFire );
			}
		}
		
	};
	
})();
