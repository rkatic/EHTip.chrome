function Emitter() {
	this._listeners = [];
}

Emitter.prototype = {
	
	addListiner: function( listener ) {
		this._listeners.push( listener );
		return this;
	},
	
	removeListiner: function( listener ) {
		var pos = this._listeners.indexOf( listener );
		
		if ( pos > -1 ) {
			this._listeners.splice( pos, 1 );
		}
		
		return this;
	},
	
	hasListener: function( listener ) {
		return this._listeners.indexOf( listener ) !== -1;
	},
	
	emit: function() {
		var listeners = this._listeners,
			l = listeners.length;
		
		if ( l === 0 ) {
			return false;
		
		} else if ( l > 1 ) {
			listeners = listeners.slice(0);
		}
		
		for ( var i = 0; i < l; ++i ) {
			listeners[i].apply( null, arguments );
		}
		
		return true;
	}
};
