module("options", function( options, require ) {
	
	var Emitter = require("events").Emitter;
	
	options.init = function( defaults ) {
		this.defaults = defaults;
		var newOptions = utils.extend( {}, defaults );
		var oldOptions = this.load();
		
		if ( oldOptions ) {
			for ( var key in oldOptions ) {
				if ( key in newOptions ) {
					newOptions[ key ] = oldOptions[ key ];
				}
			}
		}
		
		this.onSaved = new Emitter();
		this.save( newOptions );
		return newOptions;
	};
	
	options.save = function( obj ) {
		localStorage.options = JSON.stringify( obj );
		this.onSaved.emit( obj );
	};
	
	options.load = function() {
		var value = localStorage.options;
		return value ? JSON.parse( value ) : undefined;
	};

});
