
//IN_WORKER && importScripts('base.js', 'io.js', 'jobs.js', 'storage.async.js');

module('dictionary.async', function( exports, require, module ) {

	var utils = require("utils"),
		io = require("io"),
		jobs = require("jobs"),
		AsyncStorage = require("storage.async").AsyncStorage,

		common = require("common"),
		reNotWord = common.reNotWord,
		reNotWordG = common.reNotWordG,
		reWordJoinerG = common.reWordJoinerG,
		clean = common.cleanTerm,

		undefined;

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

	function testChange( s, t ) {
		return !(
			t.inspectedLeft && ~s.lastIndexOf( " ", t.inspectedLeft - 1 ) ||
			t.inspectedRight && ~s.indexOf( " ", s.length - t.inspectedRight )
		);
	}

	function fillDictionaryWithFile( dict, info, toReset ) {

		var lines = utils.splitLines( io.readFile( info.path ) );

		var term_index = info.term_column - 1;
		var value_index = info.definition_column - 1;
		var sep = info.column_separator;

		var i, l, parts, key, term, value;
		var table = [], pairs = [], map, values;
		var toKey = tokey, dump = JSON.stringify;

		for ( i = 0, l = lines.length; i < l; ++i ) {
			parts = lines[i].split( sep );

			term = ( parts[ term_index ] || "" ).trim();
			value = ( parts[ value_index ] || "" ).trim();

			if ( term && value ) {
				table.push([ toKey(term), term, i, value ]);
			}
		}

		table.sort( cmpRows );

		i = 0;
		l = table.length;

		while ( i < l ) {
			key = table[i][0];
			map = {};

			do {
				term = table[i][1];
				map[term] = values = [ table[i][3] ];

				++i;

				while ( i < l && table[i][1] === term ) {
					values.push( table[i][3] );
					++i;
				}
			} while ( i < l && table[i][0] === key )

			pairs.push([ key, dump( map ) ]);
		}

		if ( typeof dict === 'string' ) {
			dict = new Dictionary( dict );
		}

		dict._storage.transaction(
			function( t ) {
				toReset && t.reset();
				t.updateWithPairs( pairs );
			},
			this.fail,
			this.done
		);
	}

	var workerJob = jobs.createJobDealer( module.path, 'NEW_JOB', 5e3 );

	if ( IN_WORKER ) {
		jobs.addJobResolverTo( self, 'NEW_JOB', {
			fillDictionaryWithFile: fillDictionaryWithFile
		});
	}

	function cmpRows( a, b ) {
		if ( a[0] < b[0] ) return -1;
		if ( a[0] > b[0] ) return  1;
		if ( a[1] < b[1] ) return -1;
		if ( a[1] > b[1] ) return  1;
		return a[2] - b[2];
	}


	var DB_SIZE = 5 * 1024 * 1024;

	function Dictionary( name, morf ) {
		this.name = name+'';
		this._storage = AsyncStorage.open( 'dict.'+name, DB_SIZE );
		this._morf = morf;
	}

	module.Class( Dictionary, {

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
			this._storage.transaction(
				function( t ) {
					t.reset();
				},
				errorCallback,
				callback
			);
		},

		fillFromFile: function( info, toReset, errorCallback, callback ) {
			workerJob('fillDictionaryWithFile', this.name, info, toReset)
				.on = {
					done: callback,
					fail: errorCallback
				};
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

			function handle( original_term, norm_term, results, is_a_word, morf, morf_res, done ) {
				var key_term = normToKey( norm_term );
				done = done || utils.HASH();

				t.getValue(key_term, function( value ) {
					if ( value ) {
						var d = JSON.parse( value ),
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
									morf_res && !testChange(norm_k, morf_res) ) {
									continue;
								}
							}

							sub_results[ is_a_word && !reNotWord.test(k) ? "unshift" : "push" ]({
								dict: self.name,
								term: k,
								definitions: d[ k ],
								original_term: original_term,
								exact: !morf_res
							});
						}

						utils.merge( results, sub_results );

						if ( stopOnExact && !morf_res ) {
							return;
						}
					}

					if ( morf ) {
						var morf_results = morf.generate( norm_term );

						for ( var i = 0, l = morf_results.length; i < l; ++i ) {
							if ( is_a_word || testChange(norm_term, morf_results[i]) ) {
								handle(
									original_term,
									morf_results[i].value,
									results,
									is_a_word,
									null,
									morf_results[i],
									done
								);
							}
						}
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
