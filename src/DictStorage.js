utils.ns('storage.async', function( exports ) {

var SQL = {
	CREATE : "CREATE TABLE IF NOT EXISTS dict(key TEXT UNIQUE, value TEXT)",
	DROP   : "DROP TABLE IF EXISTS dict",
	REPLACE: "INSERT OR REPLACE INTO dict values(?, ?)",
	DELETE : "DELETE FROM dict WHERE key = ?",
	SELECT : "SELECT value FROM dict WHERE key = ?",
	COUNT  : "SELECT COUNT(*) AS c FROM dict WHERE key = ?",
	SELECT_ALL_KEYS : "SELECT key FROM dict",
	SELECT_ALL_PAIRS: "SELECT key, value FROM dict",
	SELECT_KEYS : "SELECT key FROM dict WHERE substr(key, 1, ?) = ?",
	SELECT_PAIRS: "SELECT key, value FROM dict WHERE substr(key, 1, ?) = ?"
};

function creationCallback( db ) {
	db.changeVersion( '', 1, createTable );
}

function createTable( t ) {
	t.executeSql( SQL.CREATE );
}

function resetTable( t ) {
	t.executeSql( SQL.DROP );
	t.executeSql( SQL.CREATE );
}

function dropTable( t ) {
	t.executeSql( SQL.DROP );
}

var DictStorage = exports.DictStorage = Class({
	
	open: function( name, estimatedSize ) {
		this._db = openDatabase(
			'dict.' + name,
			'',
			'',
			( estimatedSize == null ? 2*1024*1024 : estimatedSize ),
			creationCallback
		);
	},
	
	reset: function( errCb, cb ) {
		this._db.transaction( resetTable, errCb, cb );
	},
	
	erase: function( errCb, cb ) {
		var db = this._db;
		this._db = null;
		
		db.transaction( dropTable, errCb, cb );
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
	},
	
	hasKey: function( key, errCb, cb ) {
		this._db.readTransaction(
			function( t ) {
				new ReadTransaction( t ).hasKey( key, cb );
			},
			errCb,
			null
		);
	},
	
	getValue: function( key, errCb, cb ) {		
		this._db.readTransaction(
			function( t ) {
				new ReadTransaction( t ).getValue( key, cb );
			},
			errCb,
			null
		);
	},
	
	set: function( key, value, errCb, cb ) {
		this._db.transaction(
			function( t ) {
				new Transaction( t ).set( key, value );
			},
			errCb,
			cb
		);
	},
	
	remove: function( key, errCb, cb ) {
		this._db.transaction(
			function( t ) {
				new Transaction( t ).remove( key );
			},
			errCb,
			cb
		);
	},
	
	keys: function( prefix, errCb, cb ) {
		var keys = [], sql, args;
		
		if ( prefix ) {
			sql = SQL.SELECT_KEYS;
			args = [ prefix.length, prefix ];
			
		} else {
			sql = SQL.SELECT_ALL_KEYS;
			args = null;
		}
		
		this._db.readTransaction(
			function( t ) {
				t.executeSql( sql, args, function( t, r ) {
					for ( var i = 0, l = r.length; i < l; ++i ) {
						keys.push( r[i].key );
					}
				});
			},
			errCb,
			cb
		);
	},
	
	each: function( prefix, proc, errCb, cb ) {
		var sql, args;
		
		if ( prefix ) {
			sql = SQL.SELECT_PAIRS;
			args = [ prefix.length, prefix ];
			
		} else {
			sql = SQL.SELECT_ALL_PAIRS;
			args = null;
		}
		
		this._db.readTransaction(
			function( t ) {
				t.executeSql( sql, args, function( t, r ) {
					for ( var i = 0, l = r.length; i < l; ++i ) {
						proc( r[i].key, r[i].value );
					}
				});
			},
			errCb,
			cb
		);
	},
	
	updateWithObject: function( obj, errCb, cb ) {
		var self = this, sql = SQL.REPLACE;
		
		this._db.transaction(function( t ) {
			for ( var key in obj ) {
				t.executeSql( sql, [ key, obj[key] ] );
			}
		}, errCb, cb);
	}
});

DictStorage.open = function() {
	var ds = new DictStorage();
	ds.open.apply( ds, arguments );
	return ds;
};


DictStorage.erase = function( name ) {
	DictStorage.open( name, 0 ).erase();
};


var ReadTransaction = Class({
	
	constructor: function( tr ) {
		this._tr = tr;
	},
	
	getValue: function( key, cb, errCb ) {
		this._tr.executeSql( SQL.SELECT, [ key ],
			function( t, r ) {
				cb( r.rows.length ? r.rows.item(0).value : undefined );
			},
			errCb && function(t,e){ errCb(e); }
		);
	},
	
	hasKey: function( key, cb, errCb ) {
		this._tr.executeSql( SQL.COUNT, [ key ],
			function( t, r ) {
				cb( r.rows.item(0).c > 0 );
			},
			errCb && function(t,e){ errCb(e); }
		);
	}
});

var Transaction = Class( ReadTransaction, {
	
	set: function( key, value, errCb ) {
		this._tr.executeSql( SQL.REPLACE, [ key, value ],
			null,
			errCb && function(t,e){ errCb(e); }
		);
	},
	
	remove: function( key, errCb ) {
		this._tr.executeSql( SQL.DELETE, [ key ],
			null,
			errCb && function(t,e){ errCb(e); }
		);
	}
});

});
