utils.ns('dictionary.async', function( exports ) {
	
	var undefined;
	const DB_SIZE = 2 * 1024 * 1024;
	
	var SimpleDictionary = exports.SimpleDictionary = Class({
		
		constructor: function( name ) {
			this.name = name;
			this._dict = storage.async.DictStorage.open( name, DB_SIZE );
		},
		
		getDefinitions: function( term, errorCallback, callback ) {
			this._dict.getValue(term, errorCallback, function( value ) {
				callback( value ? JSON.parse(value) : undefined );
			});
		},
		
		map: function( terms, errorCallback, callback ) {
			var results = [];
			
			function push( value ) {
				results.push( value ? JSON.parse(value) : undefined );
			}
			
			this._dict.readTransaction(
				function( t ) {
					for ( var i = 0, l = terms.length; i < l; ++i ) {
						t.getValue( terms[i], push );
					}
				},
				errorCallback,
				function() {
					callback( results );
				}
			);
		},
		
		setDefinitions: function( term, definitions, errorCallback, callback ) {
			this._dict.set( term, JSON.stringify( definitions ), errorCallback, callback );
		},
		
		setDeinitionsFromObject: function( obj, errorCallback, callback ) {
			var hash = utils.HASH();
			
			for ( var key in obj ) {
				hash[ key ] = JSON.stringify( obj[ key ] );
			}
			
			this._dict.updateWithObject( hash, errorCallback, callback );
		},
		
		setDefinitionsFromData: function( data, errorCallback, callback ) {
			var lines = utils.splitLines( data ),
				obj = utils.HASH(), pos, term, defs, _push = [].push;
				
			for ( var i = 0, l = lines.length; i < l; ++i ) {
				pos = lines[i].indexOf('=');
				
				if ( pos !== -1 ) {
					term = lines[i].substr( 0, pos ).trim().toLowerCase();
					defs = lines[i].substr( pos + 1 ).trim().split(/\s*\|\s*/);
					
					if ( term in obj ) {
						_push.apply( obj[ term ], defs );
						
					} else {
						obj[ term ] = defs;
					}
				}
			}
			
			this.setDeinitionsFromObject( obj, errorCallback, callback );
		},
		
		removeAllDefinitions: function( errorCallback, callback ) {
			this._dict.reset( errorCallback, callback );
		},
		
		free: function( callback ) {
			this._dict.erase( null, callback );
		},
		
		lookup: function( terms, errorCallback, callback ) {
			var dictName = this.name,
				results = [];
			
			this.map(terms, errorCallback, function( arr ) {
				var results = [];
				for ( var i = 0, l = arr.length; i < l; ++i ) {
					if ( arr[i] ) {
						results.push({
							term: terms[i],
							definitions: arr[i],
							parts: [ terms[i] ],
							dict: dictName
						});
					}
				}
				callback( results );
			});
		}
	});
	
	exports.Dictionary = Class( SimpleDictionary, {
		
		constructor: function( name, morf ) {
			SimpleDictionary.call( this, name );
			
			this._morfology = ( typeof morf === "string" ) ?
				morfology.Transformations.fromFile( morf ) :
				morf;
		},
		
		lookup: function( terms, errorCallback, callback ) {
			var self = this, results = [], t;
			
			terms = ( typeof terms === "string" ) ? [ terms ] : terms.concat();
			
			function push( term, value, parts, tran ) {
				results.push({
					dict: self.name,
					term: term,
					definitions: JSON.parse( value ),
					parts: parts,
					transformed: tran
				});
			}
			
			function procTerm( term ) {
				term = term.toLowerCase();
				
				t.getValue(term, function( value ) {
					if ( value ) {
						push( term, value, [term] );
						
					} else {
						var done = utils.HASH();
						self._morfology.generate(term, function( term, parts ) {
							if ( term in done ) return;
							done[ term ] = true;
							t.getValue(term, function( value ) {
								value && push( term, value, parts, true );
							});
						});
					}
				});
			}
			
			this._dict.readTransaction(
				function( tr ) {
					t = tr
					terms.forEach( procTerm );
				},
				errorCallback,
				function() {
					callback( results );
				}
			);
		}
		
	});
	
});
