module('dictionary/async', function( exports, require ) {
	
	var utils = require("utils"),
		AsyncStorage = require("storage/async").AsyncStorage,
		
		common = require("common"),
		reNotWord = common.reNotWord,
		reNotWordG = common.reNotWordG,
		reWordJoinerG = common.reWordJoinerG,
		clean = common.cleanTerm,
		
		_hasOwn_ = Object.prototype.hasOwnProperty;
		
	function norm( s ) {
		var words = clean( s ).split( reWordJoinerG );
		for ( var i = 0, l = words.length; i < l; ++i ) {
			words[i] = words[i].replace( reNotWordG, "" );
		}
		return words.join(" ").trim().replace(/ {2,}/g, " ").toLowerCase();
	}
	
	function tokey( s ) {
		return clean( s ).replace(reNotWordG, "").toLowerCase();
	}
	
	function normToKey( s ) {
		return s.replace(/ /g, "");
	}
	
	function testChange( s, left, right ) {
		return !(
			left && s.substr(0, left.to).indexOf(" ") !== -1 ||
			right && s.slice(-right.to).indexOf(" ") !== -1
		);
	}
	
	function buildIndexedHash( obj ) {
		var hash = utils.HASH(),
			_key = tokey,
			k, d;
		
		for ( var term in obj ) {
			k = _key( term );
			d = hash[ k ];
			if ( !d ) {
				hash[ k ] = d = {__proto__: null};
			}
			d[ term ] = obj[ term ];
		}
		
		return hash;
	}
	
	
	var undefined;
	const DB_SIZE = 5 * 1024 * 1024;
	
	exports.Dictionary = Class({
		
		constructor: function( name, morf ) {
			this.name = name;
			this._storage = AsyncStorage.open( name, DB_SIZE );
			this._morf = morf;
		},
		
		set: function( term, def, errorCallback, callback ) {
			var key = tokey( term );
			
			this._storage.transaction(
				function( t ) {
					t.getValue(key, function( value ) {
						var d = value ? JSON.parse( value ) : {};
						d[ term ] = def;
						t.setValue( key, JSON.stringify(d) );
					});
				},
				errorCallback,
				callback
			);
		},
		
		reset: function( obj, errorCallback, callback ) {
			var pairs, hash, k, i, dump;
			
			if ( obj ) {
				hash = buildIndexedHash( obj );
				pairs = [],
				i = -1;
				dump = JSON.stringify;
				
				for ( k in hash ) {
					pairs[ ++i ] = [ k, dump( hash[k] ) ];
				}
			}
			
			this._storage.transaction(
				function( t ) {
					t.reset();
					
					if ( pairs ) {
						t.updateWithPairs( pairs );
					}
				},
				errorCallback,
				callback
			);
		},
		
		free: function( errorCallback, callback ) {
			this._storage.transaction(
				function( t ) {
					t.drop();
				},
				errorCallback,
				callback
			);
		},
		
		lookup: function( terms, stopOnExact, errorCallback, callback ) {
			var self = this,
				results = [],
				t;
			
			terms = ( typeof terms === "string" ) ? [ terms ] : terms;
			
			function handle( original_term, norm_term, results, is_a_word, morf, leftChange, rightChange, done ) {			
				var key_term = normToKey( norm_term );
				done = done || utils.HASH();
				
				t.getValue(key_term, function( value ) {
					if ( value ) {
						var d = JSON.parse( value ),
							exact = !leftChange && !rightChange,
							sub_results = [],
							k, norm_k;
						
						for ( k in d ) {
							if ( k in done ) {
								continue;
							}
							done[ k ] = true;
							
							if ( !is_a_word ) {
								norm_k = norm( k );
								
								if ( norm_k !== norm_term && norm_k !== key_term ||
									!exact && !testChange(norm_k, leftChange, rightChange) ) {
									continue;
								}
							}
							
							sub_results[ is_a_word && !reNotWord.test(k) ? "unshift" : "push" ]({
								dict: self.name,
								term: k,
								definitions: d[ k ],
								original_term: original_term,
								exact: exact
							});
						}
						
						utils.merge( results, sub_results );
						
						if ( stopOnExact && exact ) {
							return;
						}
					}
					
					if ( morf ) {
						morf.generate(norm_term, function( term, leftChange, rightChange ) {
							if ( is_a_word || testChange(norm_term, leftChange, rightChange) ) {
								handle( original_term, term, results, is_a_word, null, leftChange, rightChange, done );
							}
						});
					}
				});
			}
			
			this._storage.readTransaction(
				function( tr ) {
					t = tr;
					
					for ( var i = 0, l = terms.length; i < l; ++i ) {
						var term = terms[i],
							norm_term = norm( term ),
							is_a_word = norm_term.indexOf(" ") === -1;
						
						handle( term, norm_term, ( results[i] = [] ), is_a_word, self._morf );
					}
				},
				errorCallback,
				function() {
					callback( utils.flat( results ) );
				}
			);
		}
		
	});
	
});
