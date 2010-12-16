utils.ns('dictionary', function( exports ) {
	
	var STOREGE = localStorage,
		undefined;
	
	exports.SimpleDictionary = Class({
		
		constructor: function( name ) {
			this.name = name;
			this._keyPrefix = name + '.';
		},
		
		getDefinitions: function( term ) {
			var value = STOREGE.getItem( this._keyPrefix + term );
			return value === undefined ? null : JSON.parse( value );
		},
		
		setDefinitions: function( term, definitions ) {
			STOREGE.setItem( this._keyPrefix + term, JSON.stringify( definitions ) ); 
		},
		
		setDeinitionsFromObject: function( obj ) {
			var keyPrefix = this._keyPrefix;
			
			for ( var key in obj ) {
				STOREGE.setItem( keyPrefix + key, JSON.stringify( obj[key] ) );
			}
		},
		
		setDefinitionsFromFile: function( path ) {
			var lines = utils.splitLines( io.readFile( path ) ),
				obj = utils.HASH(), pos, term, defs, _push = [].push;
			
			for ( var i = 0, l = lines.length; i < l; ++i ) {
				pos = lines[i].indexOf('=');
				
				if ( pos !== -1 ) {
					term = lines[i].substr( 0, pos ).trim();
					defs = lines[i].substr( pos + 1 ).trim().split(/\s*\|\s*/);
					
					if ( term in obj ) {
						_push.apply( obj[ term ], defs );
						
					} else {
						obj[ term ] = defs;
					}
				}
			}
			
			this.setDeinitionsFromObject( obj );
		},
		
		removeAllDefinitions: function() {
			var prefix = this._keyPrefix,
				len = prefix.length;
			
			for ( var key in STOREGE ) {
				if ( key.substr(0, len) === prefix ) {
					STOREGE.removeItem( key );
				}
			}
		},
		
		lookup: function( term, callback ) {
			var defs = this.getDefinitions( term );
			defs && callback( term, defs );
		}
	});
	
	exports.Dictionary = Class( exports.SimpleDictionary, {
		
		constructor: function( name, morf ) {
			this._super( name );
			
			this._morfology = ( typeof morf === "string" ) ?
				morfology.Transforamtaions.fromFile( morf ) :
				morf;
		},
		
		lookup: function( term, callback ) {
			var self = this;
			
			function proc( term, parts ) {
				var defs = self.getDefinitions( term );
				return defs ? callback( term, defs, parts ) : true;
			}
			
			if ( proc( term, [term] ) !== false ) {
				this._morfology.generate( term, proc );
			}
			
			return results;
		}
		
	});
	
});
