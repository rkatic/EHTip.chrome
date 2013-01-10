module('storage.async', function( exports, require, module ) {

var Class = module.Class.bind( module );

var SQL = {
	CREATE_TABLE : "CREATE TABLE IF NOT EXISTS dict(key TEXT UNIQUE, value TEXT)",
	DROP_TABLE : "DROP TABLE IF EXISTS dict",
	SET : "INSERT OR REPLACE INTO dict VALUES (?, ?)",
	DELETE : "DELETE FROM dict WHERE key = ?",
	SELECT : "SELECT value FROM dict WHERE key = ?",
	COUNT_KEY : "SELECT COUNT(*) AS c FROM dict WHERE key = ?",
	SELECT_ALL_KEYS : "SELECT key FROM dict",
	SELECT_ALL_PAIRS: "SELECT key, value FROM dict",
	SELECT_KEYS_$KEYLEN_$KEY : "SELECT key FROM dict WHERE substr(key, 1, ?) = ?",
	SELECT_PAIRS_$KEYLEN_$KEY: "SELECT key, value FROM dict WHERE substr(key, 1, ?) = ?"
};


function reportError( error ) {
	console.error( error );
}

//function creationCallback( db ) {
//	db.changeVersion( '', '1', createTable, reportError );
//}

function createTable( t, cb, errCb ) {
	t.executeSql( SQL.CREATE_TABLE, null, cb, errCb );
}

function AsyncStorage() {}

Class( AsyncStorage, {

	open: function( name, estimatedSize ) {
		if ( estimatedSize == null ) {
			estimatedSize = 2 * 1024 * 1024;
		}

		this._db = openDatabase( name, '', '', estimatedSize );

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
	var self = new this();
	self.open.apply( self, arguments );
	return self;
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

function ReadTransaction( tr ) {
	this._tr = tr;
}

Class( ReadTransaction, {

	getValue: function( key, cb, errCb ) {
		this._tr.executeSql( SQL.SELECT, [ key ],
			function( t, r ) {
				cb( r.rows.length ? r.rows.item(0).value : undefined );
			},
			errCb && errorProxy( errCb )
		);
	},

	hasKey: function( key, cb, errCb ) {
		this._tr.executeSql( SQL.COUNT_KEY, [ key ],
			function( t, r ) {
				cb( r.rows.item(0).c > 0 );
			},
			errCb && errorProxy( errCb )
		);
	},

	keys: function( prefix, cb, errCb ) {
		var sql, args;

		if ( prefix ) {
			sql = SQL.SELECT_KEYS_$KEYLEN_$KEY;
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

function Transaction() {
	ReadTransaction.apply( this, arguments );
}

Class( Transaction, {
	extends: ReadTransaction,

	set: function( key, value, cb, errCb ) {
		this._tr.executeSql( SQL.SET, [ key, value ],
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

		this._tr.executeSql( SQL.DROP_TABLE, null, null, errCb );
		this._tr.executeSql( SQL.CREATE_TABLE, null, cb, errCb );
	},

	drop: function( cb, errCb ) {
		this._tr.executeSql( SQL.DROP_TABLE, null,
			cb && cbProxy( cb ),
			errCb && errorProxy( errCb )
		);
	},

	updateWithObject: function( obj, cb, errCb ) {
		var t = this._tr, sql = SQL.SET,
			c = 1, _cb;

		errCb = errCb && errorProxy( errCb );

		_cb = cb && function() {
			if ( --c === 0 ) {
				cb();
			}
		};

		for ( var key in obj ) {
			t.executeSql( sql, [ key, obj[key] ], _cb, errCb );
			++c;
		}

		_cb && _cb();
	},

	updateWithPairs: function( pairs, cb, errCb ) {
		var t = this._tr, sql = SQL.SET,
			c = pairs.length, _cb;

		errCb = errCb && errorProxy( errCb );

		if ( cb ) {
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

		for ( var i = 0, l = c; i < l; ++i ) {
			t.executeSql( sql, pairs[i], _cb, errCb );
		}
	}
});

});
