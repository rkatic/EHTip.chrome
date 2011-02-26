module('morfology', function( exports, require ) {
	
	var utils = require("utils"),
		io = require("io"),
		
		extend = utils.extend;


	exports.Transformations = Class({
		
		constructor: function( data ) {
			this._sfx = [];
			this._pfx = [];
		},
		
		addPrefixTransformation: function( pattern, prefix ) {
			if ( !/\.$/.test( pattern ) ) {
				pattern += '.';
			}
			
			this._pfx.push({
				re: new RegExp( '^' + pattern ),
				add: prefix
			});
		},
		
		addSuffixTransforamtion: function( pattern, suffix ) {
			if ( pattern.charAt(0) !== '.' ) {
				pattern = '.' + pattern;
			}
			
			this._sfx.push({
				re: new RegExp( pattern + '$' ),
				add: suffix
			});
		},
		
		generateAll: function( str ) {
			var rv = [];
			this.generate( rv.push, rv );
			return rv;
		},
		
		generate: function( str, callback, context ) {			
			var sfxResults = [], pfxResults = [], arr, rm, res, t, undef;
			
			arr = this._sfx;
			for ( var i = 0, l = arr.length; i < l; ++i ) {
				if ( arr[i].re.test( str ) ) {
					rm = RegExp.$1 ? RegExp.$1.length : 0;
					add = arr[i].add || "";
					
					res = {
						sfx_tot: RegExp['$&'].length,
						sfx_rm: rm,
						sfx_add: add,
						value: ( rm ? str.slice( 0, -rm ) : str ) + add
					};
					
					if ( callback.call( context, res ) === false ) {
						return;
					}
					
					sfxResults.push( res );
				}
			}
			
			arr = this._pfx;
			for ( var i = 0, l = arr.length; i < l; ++i ) {
				if ( arr[i].re.test( str ) ) {
					rm = RegExp.$1 ? RegExp.$1.length : 0;
					add = arr[i].add || "";
					
					res = {
						pfx_tot: RegExp['$&'].length,
						pfx_rm: rm,
						pfx_add: add,
						value: add + ( rm ? str.substr( rm ) : str )
					};
					
					if ( callback.call( context, res ) === false ) {
						return;
					}
					
					pfxResults.push( res );
				}
			}
			
			if ( sfxResults.length === 0 || pfxResults.length === 0 ) {
				return;
			}

			for ( var i = 0, l = sfxResults.length; i < l; ++i ) {
				for ( var j = 0, m = pfxResults.length; j < m; ++j ) {
					
					res = extend( extend( {}, sfxResults[i] ), pfxResults[j] );
					
					t = str.slice( res.pfx_rm, -res.sfx_rm || undef );
					
					if ( t ) {
						res.value = res.pfx_add + t + res.sfx_add;
						
						if ( callback.call( context, res ) === false ) {
							return;
						}
					}
				}
			}
		}
	});
	
	exports.Transformations.fromFile = function( path ) {
		var lines = utils.splitLines( io.readFile( path ) ),
			self = new this(),
			parts;
		
		for ( var i = 0, l = lines.length; i < l; ++i ) {
			parts = lines[i].trim().split(/\s+/);
			
			if ( parts[0] === 'PFX' ) {
				self.addPrefixTransformation( parts[1], parts[2] );
				
			} else if ( parts[0] === 'SFX' ) {
				self.addSuffixTransforamtion( parts[1], parts[2] );
			}
		}
		
		return self;
	};
	
});
