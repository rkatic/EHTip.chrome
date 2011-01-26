
var utils = (function( GLOBAL ){


var OP = Object.prototype,
	_toStr_ = OP.toString,
	_isProtoOf_ = OP.isPrototypeOf,
	_defGetter_ = OP.__defineGetter__,
	_defSetter_ = OP.__defineSetter__,
	_getGetter_ = OP.__lookupGetter__,
	_getSetter_ = OP.__lookupSetter__,
	keys = Object.keys,
	protoOf = Object.getPrototypeOf;


function ns( name, body ) {
	if ( !body && isFunction(name) ) {
		body = name;
		name = null;
	}
	
	var m = ( name == null ) ? {} : deepGet( GLOBAL, name, true );
	
	if ( body ) body( m );
	
	return m;
}


function deepGet( o, names, create ) {
	if ( typeof names === "string" ) {
		names = names.split('.');
	}
	
	var n = names.length;
	
	if ( !create ) {
		create = undefined;
		--n;
	}
	
	for ( var i = 0; o && i < n; ++i ) {
		o = o[ names[i] ]
			|| create && ( o[ names[i] ] = {} );
	}
	
	return create ? o : ( o && o[ names[n] ] );
}

function deepSet( o, name, value ) {
	var names = name.split('.');
	name = names.pop();
	deepGet( o, names, true )[ name ] = value;
}

function HASH() {
	return {__proto__: null};
}

var isArray = Array.isArray || function(o) {
	return !!o && _toStr_.call(o) === "[object Array]";
};

function isFunction(o) {
	//return !!o && _toStr_.call(o) === "[object Function]";
	return typeof o === "function";
}

function isPlainObject(o) {
	return !!o && _toStr_.call(o) === "[object Object]" && !protoOf( protoOf(o) || OP );
}

function classOf(o) {
	return _toStr_.call(o).slice(8, -1);
}

function extend( dst, src ) {
	for ( var key in src ) {
		dst[ key ] = src[ key ];
	}
	return dst;
}

function mixin( dst, src, inc ) {
	var g, s;
	
	for ( var name in noiter(inc || src) ) {
		g = _getGetter_.call(src, name);
		s = _getSetter_.call(src, name);
		
		if ( g || s ) {
			if ( g ) _defGetter_.call(dst, name, g);
			if ( s ) _defSetter_.call(dst, name, s);
			
		} else {
			dst[ name ] = src[ name ];
		}
	}
	
	return dst;
}

function update( dst, src ) {
	var inc = HASH(), o = src,
		undefined;
	
	while ( o && o !== dst && !_isProtoOf_.call(o, dst) ) {
		var keys = Object.keys( o );
		
		for ( var i = 0, l = keys.length; i < l; ++i ) {
			inc[ keys[i] ] = undefined;
		}
		
		o = protoOf( o );
	}
	
	return mixin( dst, src, inc );
}

function splitLines( str ) {
	return str.split(/\r\n|\n|\r/);
}

function saveObject( name, obj ) {
	localStorage.setItem( name, JSON.stringify( obj ) );
	return obj;
}

function loadObject( name ) {
	var value = localStorage.getItem( name );
	return value ? JSON.parse( value ) : undefined;
}

function remove( arr, obj ) {
	var pos = arr.indexOf( obj );
	if ( pos === -1 ) {
		return false;
	} else {
		arr.splice( pos, 1 );
		return true;
	}
}

return {
	ns: ns,
	deepGet: deepGet,
	deepSet: deepSet,
	HASH: HASH,
	isArray: isArray,
	isFunction: isFunction,
	isPlainObject: isPlainObject,
	classOf: classOf,
	extend: extend,
	mixin: mixin,
	update: update,
	splitLines: splitLines,
	saveObject: saveObject,
	loadObject: loadObject,
	remove: remove
};

})( this );
