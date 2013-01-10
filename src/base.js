var IN_WORKER = typeof importScripts === 'function';

(function(){

	var parse = JSON.parse,
		dump = JSON.stringify,
		loadedModules = {},
		importingPath;

	function resolve( curr, path ) {
		var a = curr.split('/'),
			b = path.split('/'),
			n = 0;

		a = a.slice( 0, path[0] === '.' ? -1 : a[1] === '' ? 3 : 0 );
		n = a.length;

		for ( var i = 0; i < b.length; ++i ) {
			if ( b[i] === '..' && n > 0 && a[n-1] !== '..' ) {
				--n;

			} else if ( b[i] !== '.' ) {
				a[ n++ ] = b[i];
			}
		}

		a.length = n;

		return a.join('/');
	}

	function _require( name ) {
		var path = name + '.js';

		if ( !loadedModules[ path ] ) {
			if ( self.importScripts ) {
				importingPath = path;
				importScripts( path );
			} else {
				throw Error('Including "'+name+' - file "'+path+'" do not exists.');
			}
		}

		return loadedModules[ path ].exports;
	}

	function module( longName, body ) {
		if ( typeof longName !== 'string' ) {
			body = body || longName;
			longName = null;
		}

		var path = importingPath || longName && longName + '.js';

		importingPath = null;

		if ( path in loadedModules ) {
			throw new Error('module '+path+' already loaded');
		}

		var m = new Module( path );
		loadedModules[ path ] = m;

		function require( name ) {
			return _require( m.resolve(name) );
		}

		body( m.exports, require, m );
	}

	self.module = module;
	module.resolve = resolve;

	function Class( cls, prototype ) {
		cls.prototype = prototype;
		prototype.constructor = cls;

		var base = prototype.extends;

		if ( base ) {
			cls.__proto__ = base;
			cls.prototype.__proto__ = base.prototype;
		}

		return cls;
	};

	function Module( path ) {
		this.path = path;
		this.exports = {};
	}

	Class( Module, {

		resolve: function( path ) {
			return resolve( this.path, path );
		},

		spawn: function( path ) {
			var worker = new Worker('base.js');
			worker.postMessage(dump({
				qqpfce3249al: 'wlo4303lede',
				to_import: path ? this.resolve( path ) : this.path,
			}));
			return worker;
		},

		Class: function( cls, prototype ) {
			prototype && Class( cls, prototype );
			if ( cls.name && cls.name[0] !== '_' ) {
				this.exports[ cls.name ] = cls;
			}
			return cls;
		},

		_Class: Class
	});

	if ( IN_WORKER ) {
		var onMessage = function( event ) {
			var o = event.data && JSON.parse( event.data );
			if ( o instanceof Object && o.qqpfce3249al === 'wlo4303lede' ) {
				if ( o.to_import ) {
					importingPath = o.to_import;
					importScripts( importingPath );
				}
				self.removeEventListener('message', onMessage, false);
			}
		};

		self.addEventListener('message', onMessage, false);
	}
})();

module("requests", function( exports ) {

	exports.sendRequest = function( worker, msg, callback ) {
		var channel = new MessageChannel();

		channel.port1.onmessage = function( event ) {
			channel.port1.close();
			callback.apply( null, JSON.parse( event.data ) );
		};

		worker.postMessage( JSON.stringify( msg ), [ channel.port2 ] );
	};

	exports.createRequestHandler = function( handler ) {
		return function( event ) {
			var port = event.ports && event.ports[0];
			if ( !port || !event.data ) return;

			function send() {
				port.postMessage( JSON.stringify( [].slice.call(arguments) ) );
			}

			handler( JSON.parse( event.data ), send );
		};
	};

	exports.addRequestHandlerTo = function( worker, handler ) {
		onMessage = exports.createRequestHandler( handler );
		worker.addEventListener('message', onMessage, false);
		return onMessage;
	};

});

//var require;
//module('', function( _, req ) {
//	require = req;
//});

module("utils", function( x ) {

	var OP = Object.prototype,
		_toStr_ = OP.toString,
		protoOf = Object.getPrototypeOf,

		A = [],
		_slice_ = A.slice,
		_concat_ = A.concat,
		_push_ = A.push;

	//x.bind = Function.call.bind( Function.bind );
	function bind( f, o ) {
		return function() {
			return f.apply( t, arguments );
		};
	}

	x.bind = bind;

	//x.generic = Function.bind.bind( Function.call );
	x.generic = function( f ) {
		return bind( Function.call, f );
	};

	x.HASH = function() {
		return {__proto__: null};
	};

	x.isArray = Array.isArray || function(o) {
		return !!o && _toStr_.call(o) === "[object Array]";
	};

	x.toArray = function( obj ) {
		return _slice_.call( obj );
	};

	x.concat = x.bind( _concat_, A );

	x.merge = function( dst, src ) {
		for ( var i = 0, l = src.length; i < l; ++i ) {
			dst.push( src[i] );
		}
		return dst;
	};

	x.flat = function( a ) {
		return _concat_.apply( A, a );
	};

	x.flatR = function( a ) {
		do {
			a = _concat_.apply( A, a );

		} while ( a.some( x.isArray ) );

		return a;
	};

	x.isFunction = function(o) {
		//return !!o && _toStr_.call(o) === "[object Function]";
		return typeof o === "function";
	};

	x.isPlainObject = function(o) {
		return !!o && _toStr_.call(o) === "[object Object]" && !protoOf( protoOf(o) || OP );
	};

	x.classOf = function(o) {
		return _toStr_.call(o).slice(8, -1);
	};

	x.extend = function( dst, src ) {
		for ( var key in src ) {
			dst[ key ] = src[ key ];
		}
		return dst;
	};

	x.splitLines = function( str ) {
		return str.split(/\r\n|\n|\r/);
	};

	x.saveObject = function( name, obj ) {
		localStorage.setItem( name, JSON.stringify( obj ) );
		return obj;
	};

	x.loadObject = function( name ) {
		var value = localStorage.getItem( name );
		return value ? JSON.parse( value ) : undefined;
	};

	x.removeFromArray = function( arr, obj ) {
		var pos = arr.indexOf( obj );
		if ( pos !== -1 ) {
			arr.splice( pos, 1 );
		}
		return pos;
	};

	x.pluck = function( arr, prop ) {
		var res = [];
		for ( var i = 0, l = arr.length; i < l; ++i ) {
			res[i] = arr[i][ prop ];
		}
		return res;
	};

	x.values = function( obj ) {
		var res = [];
		for ( var key in obj ) {
			res.push( obj[key] );
		}
		return res;
	};

	x.keys = Object.keys;

	x.isEmpty = function( obj ) {
		for ( var k in obj ) {
			return false;
		}
		return true;
	};

	x.findPyProperty = function( array, prop, value ) {
		for ( var i = 0, l = array.length; i < l; ++i ) {
			if ( array[i][ prop ] === value ) {
				return array[i];
			}
		}
		return undefined;
	};

	x.override = function( dst, src, valids ) {
		if ( !valids ) {
			valids = dst;
		}

		if ( src ) {
			for ( var k in src ) {
				if ( k in valids ) {
					dst[ k ] = src[ k ];
				} else {
					throw new Error( 'invalid option name: '+ k );
				}
			}
		}

		return dst;
	};

	x.stack = function( proto, mix, valids ) {
		return x.override( {__proto__: proto}, mix, valids || proto );
	};

	x.setValueOfProperties = function( obj, props, value ) {
		for ( var i = 0, l = props.length; i < l; ++i ) {
			obj[ props[i] ] = value;
		}
		return obj;
	};
});


module("common", function( exports ) {

	exports.reNotWord = /[^\w\u00c0-\uFFFF\']|[\d“”_]/;
	exports.reNotWordG = /(?:[^\w\u00c0-\uFFFF\']|[\d“”_])+/g;

	exports.reWordJoiner = /[\s—\-_]+/;
	exports.reWordJoinerG = /[\s—\-_]+/g;


	function removeBounded( str, a, b ) {
		var i = str.indexOf( a );

		if ( i === -1 ) {
			return str;
		}

		var deep = 0, c,
			res = str.substr(0, i);

		for ( ; c = str[i]; ++i ) {
			if ( c === a ) {
				++deep;

			} else if ( c === b ) {
				if ( deep ) --deep;

			} else if ( deep === 0 ) {
				res += c;
			}
		}

		return res;
	}

	exports.cleanTerm = function( term ) {
		term = removeBounded( term, '(', ')' );
		term = removeBounded( term, '[', ']' );
		term = removeBounded( term, '{', '}' );
		return term.trim().replace(/\s+/g, " ");
	};

});
