var options = {
	init: function( defaults ) {
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
	},
	
	save: function( obj ) {
		localStorage.options = JSON.stringify( obj );
		this.onSaved.emit( obj );
	},
	
	load: function() {
		var value = localStorage.options;
		return value ? JSON.parse( value ) : undefined;
	}
};
