
function Class( base, prototype ) {
	var ctor;
	
	if ( typeof base !== "function" ) {
		prototype = prototype || base;
		base = null;
	}
	
	if ( prototype && prototype.hasOwnProperty("constructor") ) {
		ctor = prototype.constructor;
		
	} else if ( base ) {
		ctor = function() {
			return base.apply( this, arguments );
		};
		
	} else {
		ctor = function(){};
	}
	
	if ( prototype ) {
		ctor.prototype = prototype;
		prototype.constructor = ctor;
	}
	
	if ( base ) {
		ctor.__proto__ = base;
		ctor.prototype.__proto__ = base.prototype;
	}
	
	return ctor;
}
