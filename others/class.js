var Class = (function(){
	
var isFunction = utils.isFunction,
	isArray = utils.isArray,
	isPlainObject = utils.isPlainObject,
	update = utils.update,
	protoOf = Object.getPrototypeOf,
	OP = Object.prototype,
	_getter_ = OP.__lookupGetter__,
	_setter_ = OP.__lookupSetter__;


function Class() {
	var a = arguments, i = 0,
		base = isFunction( a[i] ) ? a[i++] : null,
		mixins = isArray( a[i] ) ? a[i++] : null,
		proto = a[i];
	
	if ( proto && !isPlainObject(proto) ) {
		throw new TypeError();
	}
	
	if ( base && base.name === "Object" && !protoOf(base.prototype) ) {
		base = null;
	}
	
	var cls = proto && proto.hasOwnProperty("constructor") ?
		_wsuper( proto.constructor, base ) :
		( base ? function(){ base.apply(this, arguments); } : function(){} );
	
	if ( base || mixins ) {
		if ( base ) {
			Class.inherit( cls, base );
		}
		
		if ( mixins ) {
			mixins.forEach(function( m ) {
				var o = isFunction( m ) ? cls : cls.prototype;
				Class.mixin( o, m );
			});
		}
		
		if ( proto ) {
			override( cls.prototype, proto );
		}
		
	} else if ( proto ) {
		cls.prototype = proto;
	}
	
	cls.prototype.constructor = cls;
	
	return cls;
}


function _safeop( op, o, m ) {
	var prop = isFunction( o ) ? "prototype" : "constructor",
		desc = Object.getOwnPropertyDescriptor( o, prop );
	
	try {
		return op( o, m );
		
	} finally {
		if ( desc ) {
			Object.defineProperty( o, prop, desc );
			
		} else {
			delete o[ prop ];
		}
	}
}


Class.inherit = function( cls, base ) {
	cls.__proto__ = base;
	cls.prototype.__proto__ = base.prototype;
};


Class.mixin = function( o, m ) {
	if ( isFunction(o) && isFunction(m) ) {
		_safeop( update, o.prototype, m.prototype );
	}
	
	_safeop( update, o, m );
};


function override( dst, src ) {
	var d, proto = protoOf( dst );
		
	for ( var name in src ) {
		d = Object.getOwnPropertyDescriptor( src, name );
		
		if ( !d ) {
			continue;
		}
		
		if ( d.get || d.set ) {
			d.get = d.get ?
				_wsuper( d.get, _getter_.call(proto, name) ) :
				_getter_.call(dst, name);
		
			d.set = d.set ?
				_wsuper( d.set, _setter_.call(proto, name) ) :
				_setter_.call(dst, name);
			
		} else if ( isFunction( d.value ) ) {
			d.value = _wsuper( d.value, proto, name );
		}
		
		Object.defineProperty( dst, name, d );
	}
	
	return dst;
}

Class.override = function( o, m ) {
	if ( !isPlainObject(m) ) {
		throw new TypeError();
	}
	
	_safeop( override, o, m );
};


function _wsuper( fn, _super, i ) {
	return ( _super && /\b_super\b/.test(fn) ) ?
		function() {
			var t = this._super;
			this._super = i ? _super[i] : _super;
			try {
				return fn.apply( this, arguments );
			} finally {
				this._super = t;
			}
		} :
		fn;
}


return Class;

})();
