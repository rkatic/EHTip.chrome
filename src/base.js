
var module = (function(){
	
	var _defined = {};
	
	function resolve( curr, path ) {
		var a = curr.split('/'),
			b = path.split('/');
		
		a.pop();
		
		for ( var i = 0; i < b.length; ++i ) {
			if ( b[i] === '..' ) {
				a.pop();
			
			} else if ( b[i] !== '.' ) {
				a.push( b[i] );
			}
		}
		
		return a.join('/');
	}
	
	return function module( currName, body ) {
		var exports = {};
		
		_defined[ '/' + currName.toLowerCase() ] = exports;
		
		function require( name ) {
			if ( name[0] === '.' ) {
				name = resolve( currName, name );
			}
			
			var id = '/' + name.toLowerCase();
			
			if ( !_defined[id] ) {
				throw Error(currName + " - module '" + name + "' do not exists.")
			}
			
			return _defined[id];
		}
		
		body( exports, require );
	};
	
})();

//var require;
//module('', function( _, req ) {
//	require = req;
//});


function Class( base, prototype ) {
	if ( typeof base !== "function" ) {
		prototype = prototype || base;
		base = null;
	}
	
	var ctor = ( prototype && prototype.hasOwnProperty("constructor") ) ?
		prototype.constructor :
		( base ) ?
			function() { return base.apply( this, arguments ); } :
			function(){};
	
	if ( prototype ) {
		ctor.prototype = prototype;
		prototype.constructor = ctor;
	}
	
	if ( base ) {
		ctor.__proto__ = base;
		ctor.prototype.__proto__ = base.prototype;
	}
	
	return ctor;
};


module("utils", function( utils ) {
	
	var OP = Object.prototype,
		_toStr_ = OP.toString,
		protoOf = Object.getPrototypeOf;
	
	utils.HASH = function() {
		return {__proto__: null};
	};
	
	utils.isArray = Array.isArray || function(o) {
		return !!o && _toStr_.call(o) === "[object Array]";
	};
	
	utils.isFunction = function(o) {
		//return !!o && _toStr_.call(o) === "[object Function]";
		return typeof o === "function";
	};
	
	utils.isPlainObject = function(o) {
		return !!o && _toStr_.call(o) === "[object Object]" && !protoOf( protoOf(o) || OP );
	};
	
	utils.classOf = function(o) {
		return _toStr_.call(o).slice(8, -1);
	};
	
	utils.extend = function( dst, src ) {
		for ( var key in src ) {
			dst[ key ] = src[ key ];
		}
		return dst;
	};
	
	utils.splitLines = function( str ) {
		return str.split(/\r\n|\n|\r/);
	};
	
	utils.saveObject = function( name, obj ) {
		localStorage.setItem( name, JSON.stringify( obj ) );
		return obj;
	};
	
	utils.loadObject = function( name ) {
		var value = localStorage.getItem( name );
		return value ? JSON.parse( value ) : undefined;
	};
	
	utils.remove = function( arr, obj ) {
		var pos = arr.indexOf( obj );
		if ( pos !== -1 ) {
			arr.splice( pos, 1 );
		}
		return pos;
	};
});
