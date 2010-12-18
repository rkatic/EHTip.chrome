
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
}
