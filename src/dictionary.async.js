module('dictionary/async', function( exports, require ) {
	
	var utils = require("utils"),
		storage = require("storage/async"),
		
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
	
	
	var undefined;
	const DB_SIZE = 5 * 1024 * 1024;
	
	exports.Dictionary = Class({
		
		constructor: function( name, morf ) {
			this.name = name;
			this._dict = storage.DictStorage.open( name, DB_SIZE );
			this._morfology = morf;
		},
		
		get: function( term, errorCallback, callback ) {
			this._dict.getValue(tokey(term), errorCallback, function( value ) {
				if ( value ) {
					var d = JSON.parse( value );
					
					if ( d && _hasOwn_.call(d, term) ) {
						value = d[ term ];
					}
				}
				
				callback( value || undefined );
			});
		},
		
		set: function( term, def, errorCallback, callback ) {
			var key = tokey( term );
			
			this._dict.transaction(
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
		
		// WARNING: not safe if not empty
		setFromObject: function( obj, errorCallback, callback ) {
			var k, d, hash = utils.HASH(),
				stringify = JSON.stringify,
				pairs = [], i = -1;
			
			for ( var term in obj ) {
				k = tokey( term );
				d = hash[ k ];
				if ( !d ) {
					hash[ k ] = d = {};
				}
				d[ term ] = obj[ term ];
			}
			
			for ( k in hash ) {
				pairs[ ++i ] = [ k, stringify(hash[k]) ];
			}
			
			this._dict.updateWithPairs( pairs, errorCallback, callback );
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
				t;
			
			terms = ( typeof terms === "string" ) ? [ terms ] : terms.concat();
			
			function handle( original_term, norm_term, simple, morf, leftChange, rightChange, done ) {			
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
							
							if ( !simple ) {
								norm_k = norm( k );
								
								if ( norm_k !== norm_term && norm_k !== key_term ||
									!exact && !testChange(norm_k, leftChange, rightChange) ) {
									continue;
								}
							}
							
							sub_results[ simple && !reNotWord.test(k) ? "unshift" : "push" ]({
								dict: self.name,
								term: k,
								definitions: d[ k ],
								original_term: original_term,
								exact: exact
							});
						}
						
						results.push.apply( results, sub_results );
						
						if ( stopOnExact && exact ) {
							return;
						}
					}
					
					if ( morf ) {
						morf.generate(norm_term, function( term, leftChange, rightChange ) {
							if ( simple || testChange(norm_term, leftChange, rightChange) ) {
								handle( original_term, term, simple, null, leftChange, rightChange, done );
							}
						});
					}
				});
			}
			
			this._dict.readTransaction(
				function( tr ) {
					t = tr;
					terms.forEach(function( term ) {
						var norm_term = norm( term );
						handle( term, norm_term, norm_term.indexOf(" ") === -1, self._morfology );
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
