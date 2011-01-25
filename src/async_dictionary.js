module('dictionary/async', function( exports, require ) {
	
	var utils = require("utils"),
		storage = require("storage/async");
	
	var undefined;
	const DB_SIZE = 2 * 1024 * 1024;
	
	exports.Dictionary = Class({
		
		constructor: function( name, morf ) {
			this.name = name;
			this._dict = storage.DictStorage.open( name, DB_SIZE );
			this._morfology = morf;
		},
		
		get: function( term, errorCallback, callback ) {
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
		
		set: function( term, def, errorCallback, callback ) {
			this._dict.set( term, JSON.stringify( def ), errorCallback, callback );
		},
		
		setFromObject: function( obj, errorCallback, callback ) {
			var hash = utils.HASH();
			
			for ( var key in obj ) {
				hash[ key ] = JSON.stringify( obj[ key ] );
			}
			
			this._dict.updateWithObject( hash, errorCallback, callback );
		},
		
		empty: function( errorCallback, callback ) {
			this._dict.reset( errorCallback, callback );
		},
		
		free: function( callback ) {
			this._dict.erase( null, callback );
		},
		
		lookup: function( terms, stopOnExact, errorCallback, callback ) {
			var self = this,
				results = [],
				done = utils.HASH(),
				t;
			
			terms = ( typeof terms === "string" ) ? [ terms ] : terms.concat();
			
			function handle( originalTerm, term, dashed, morf ) {
				if ( term in done ) {
					return;
				}
				done[ term ] = true;
				
				t.getValue(term, function( value ) {
					if ( value ) {
						results.push({
							dict: self.name,
							term: term,
							definitions: JSON.parse( value ),
							originalTerm: originalTerm
						});
						
						if ( stopOnExact && term === originalTerm ) {
							return;
						}
					}
					
					if ( dashed ) {
						handle( originalTerm, term.replace(/-/g, "") );
					}
					
					if ( morf ) {
						morf.generate(term, function( term ) {
							handle( originalTerm, term, dashed );
						});
					}
				});
			}
			
			this._dict.readTransaction(
				function( tr ) {
					t = tr;
					terms.forEach(function( term ) {
						handle( term, term, term.indexOf('-'), self._morfology );
					});
				},
				errorCallback,
				function() {
					callback( results );
				}
			);
		}
		
	});
	
});
