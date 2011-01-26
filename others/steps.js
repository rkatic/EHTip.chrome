var steps = (function(){
	
function step( prev, callback, vars, next ) {
	var c = 1;
	
	var step = function() {
		if ( !callback ) {
			throw new Error('step alredy initialized');
		}
		
		var names = arguments, done;
		
		++c;
		
		return function() {
			if ( done ) return;
			done = true;
			
			if ( c > 0 ) {
				for ( var i = 0; i < names.length; ++i ) {
					vars[ names[i] ] = arguments[i];
				}
				
				if ( --c === 0 ) {
					step.over = true;
					next( step );
				}
			}
		};
	};
	
	step.prev = prev;
	
	step.abort = function( all ) {
		var r = c;
		if ( c > 0 ) {
			c = 0;
			step.over = true;
			step.aborted = true;
			!all && next( step );
		}
		return r;
	};
	
	callback( vars, step );
	callback = null;
	
	if ( --c === 0 ) {
		step.over = true;
		next( step );
	}
}

var _vars_
	_callbacks_,
	_slice = [].slice;
	
function steps() {
	var vars = _vars_ || {},
		callbacks = _callbacks_ || arguments,
		n = callbacks.length - 1,
		i = -1;
	
	_vars_ = null;
	_callbacks_ = null;
	
	var next = function( last ) {
		if ( ++i < n ) {
			step( last, callbacks[i], vars, next );
		
		} else {
			callbacks[i]( vars );
		}
	};

	if ( n > i ) next();
}

steps.Function = function() {
	var names = arguments,
		names_len = 0,
		callbacks;
	
	while ( typeof names[names_len] === "string" ) {
		++names_len
	}
	
	callbacks = _slice.call( arguments, names_len );
	
	return function() {
		_vars_ = {};
		_callbacks_ = callbacks;
		
		for ( var i = 0; i < names_len; ++i ) {
			_vars_[ names[i] ] = arguments[i];
		}
		
		steps();
	};
};

return steps;
	
})();

