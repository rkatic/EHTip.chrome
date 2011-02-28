module('storage/async', function( exports ) {

var SQL = {
	CREATE : "CREATE TABLE IF NOT EXISTS dict(key TEXT UNIQUE, value TEXT)",
	DROP   : "DROP TABLE IF EXISTS dict",
	REPLACE: "INSERT OR REPLACE INTO dict VALUES (?, ?)",
	DELETE : "DELETE FROM dict WHERE key = ?",
	SELECT : "SELECT value FROM dict WHERE key = ?",
	COUNT  : "SELECT COUNT(*) AS c FROM dict WHERE key = ?",
	SELECT_ALL_KEYS : "SELECT key FROM dict",
	SELECT_ALL_PAIRS: "SELECT key, value FROM dict",
	SELECT_KEYS : "SELECT key FROM dict WHERE substr(key, 1, ?) = ?",
	SELECT_PAIRS: "SELECT key, value FROM dict WHERE substr(key, 1, ?) = ?"
};


function reportError( error ) {
	console.error( error );
}

//function creationCallback( db ) {
//	db.changeVersion( '', '1', createTable, reportError );
//}

function createTable( t, cb, errCb ) {
	t.executeSql( SQL.CREATE, null, cb, errCb );
}

var AsyncStorage = exports.AsyncStorage = Class({
	
	open: function( name, estimatedSize ) {
		this._db = openDatabase(
			'dict.' + name,
			'',
			'',
			( estimatedSize == null ? 2*1024*1024 : estimatedSize )
		);
		
		this._db.transaction( createTable, reportError );
	},
	
	readTransaction: function( cb, errCb, succCb ) {
		this._db.readTransaction(
			function( t ) {
				cb( new ReadTransaction(t) );
			},
			errCb,
			succCb
		);
	},
	
	transaction: function( cb, errCb, succCb ) {
		this._db.transaction(
			function( t ) {
				cb( new Transaction(t) );
			},
			errCb,
			succCb
		);
	}
});

AsyncStorage.open = function() {
	var ds = new AsyncStorage();
	ds.open.apply( ds, arguments );
	return ds;
};


function cbProxy( cb ) {
	return function() {
		cb();
	};
}

function errorProxy( errCb ) {
	return function( _, error ){
		errCb( error );
	};
}

var ReadTransaction = Class({
	
	constructor: function( tr ) {
		this._tr = tr;
	},
	
	getValue: function( key, cb, errCb ) {
		this._tr.executeSql( SQL.SELECT, [ key ],
			function( t, r ) {
				cb( r.rows.length ? r.rows.item(0).value : undefined );
			},
			errCb && errorProxy( errCb )
		);
	},
	
	hasKey: function( key, cb, errCb ) {
		this._tr.executeSql( SQL.COUNT, [ key ],
			function( t, r ) {
				cb( r.rows.item(0).c > 0 );
			},
			errCb && errorProxy( errCb )
		);
	},
	
	keys: function( prefix, cb, errCb ) {
		var sql, args;
		
		if ( prefix ) {
			sql = SQL.SELECT_KEYS;
			args = [ prefix.length, prefix ];
			
		} else {
			sql = SQL.SELECT_ALL_KEYS;
			args = null;
		}
		
		this._tr.executeSql( sql, args,
			function( t, res ) {
				var keys = [], rows = res.rows;
				
				for ( var i = 0, l = rows.length; i < l; ++i ) {
					keys.push( rows.item(i).key );
				}
				
				cb( keys );
			},
			errCb && errorProxy( errCb )
		);
	}
});

var Transaction = Class( ReadTransaction, {
	
	set: function( key, value, cb, errCb ) {
		this._tr.executeSql( SQL.REPLACE, [ key, value ],
			cb && cbProxy( cb ),
			errCb && errorProxy( errCb )
		);
	},
	
	remove: function( key, cb, errCb ) {
		this._tr.executeSql( SQL.DELETE, [ key ],
			cb && cbProxy( cb ),
			errCb && errorProxy( errCb )
		);
	},
	
	reset: function( cb, errCb ) {
		cb = cb && cbProxy( cb )
		errCb = errCb && errorProxy( errCb );
		
		this._tr.executeSql( SQL.DROP, null, null, errCb );
		this._tr.executeSql( SQL.CREATE, null, cb, errCb );
	},
	
	drop: function( cb, errCb ) {
		this._tr.executeSql( SQL.DROP, null,
			cb && cbProxy( cb ),
			errCb && errorProxy( errCb )
		);
	},
	
	updateWithObject: function( obj, cb, errCb ) {
		var t = this._tr, sql = SQL.REPLACE,
			c, _cb;
			
		errCb = errCb && errorProxy( errCb );
		
		if ( cb ) {
			c = Object.keys( obj ).length;
			
			if ( c === 0 ) {
				cb();
				return;
			}
			
			_cb = function() {
				if ( --c === 0 ) {
					cb();
				}
			};
		}
		
		for ( var key in obj ) {
			t.executeSql( sql, [ key, obj[key] ], _cb, errCb );
		}
	},
	
	updateWithPairs: function( pairs, cb, errCb ) {
		var t = this._tr, sql = SQL.REPLACE,
			l = pairs.length, c, _cb;
			
		errCb = errCb && errorProxy( errCb );
		
		if ( cb ) {
			c = l;
			
			if ( c === 0 ) {
				cb();
				return;
			}
			
			_cb = function() {
				if ( --c === 0 ) {
					cb();
				}
			};
		}
		
		for ( var i = 0, l = pairs.length; i < l; ++i ) {
			t.executeSql( sql, pairs[i], _cb, errCb );
		}
	}
});
	
});
