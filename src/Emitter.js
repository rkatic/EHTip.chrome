function Emitter() {
	this._listeners = [];
}

Emitter.prototype = {
	
	addListiner: function( listener ) {
		this._listeners.push( listener );
		return this;
	},
	
	removeListiner: function( listener ) {
		var listeners = this._listeners,
			l = listeners.length;
		
		for ( var i = 0; i < l; ++i ) {
			if ( listener === listeners[i] ) {
				listeners.splice( i, 1 );
				break;
			}
		}
		
		return this;
	},
	
	hasListener: function( listener ) {
		return this._listeners.indexOf( listener ) !== -1;
	},
	
	emit: function() {
		var listeners = this._listeners,
			l = listeners.length;
		
		if ( !l ) {
			return false;
		
		} else if ( l > 1 ) {
			listeners = listeners.slice(0);
		}
		
		switch ( arguments.length ) {
			case 0:
				for ( var i = 0; i < l; ++i ) {
					listeners[i]();
				}
				break;
			
			case 1:
				for ( var i = 0; i < l; ++i ) {
					listeners[i]( arguments[0] );
				}
				break;
			
			case 2:
				for ( var i = 0; i < l; ++i ) {
					listeners[i]( arguments[0], arguments[1] );
				}
				break;
			
			default:				
				var args = listeners.slice.call( arguments, 0 ); 
			
				for ( var i = 0; i < l; ++i ) {
					listeners[i].apply( null, args );
				}
		}
		
		return true;
	}
};
