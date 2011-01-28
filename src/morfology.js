module('morfology', function( exports, require ) {
	
	var utils = require("utils"),
		io = require("io");	

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
		
		generate: function( str, callback ) {			
			var sufData = [], preData = [], arr, rm, t, sd, pd, undef;
			
			arr = this._sfx;
			for ( var i = 0, l = arr.length; i < l; ++i ) {
				if ( arr[i].re.test( str ) ) {
					rm = RegExp.$1 ? RegExp.$1.length : 0;
					
					sd = {
						to: RegExp['$&'].length,
						rm: rm,
						add: arr[i].add || ""
					};
					
					t = ( rm ? str.slice( 0, -rm ) : str ) + sd.add;
					
					if ( callback( t, null, sd ) === false ) {
						return;
					}
					
					sufData.push( sd );
				}
			}
			
			arr = this._pfx;
			for ( var i = 0, l = arr.length; i < l; ++i ) {
				if ( arr[i].re.test( str ) ) {
					rm = RegExp.$1 ? RegExp.$1.length : 0;
					
					pd = {
						to: RegExp['$&'].length,
						rm: rm,
						add: arr[i].add || ""
					};
					
					t = pd.add + ( rm ? str.substr( rm ) : str );
					
					if ( callback( t, pd, null ) === false ) {
						return;
					}
					
					preData.push( pd );
				}
			}
			
			if ( sufData.length === 0 || preData.length === 0 ) {
				return;
			}

			for ( var i = 0, ii = sufData.length; i < ii; ++i ) {
				for ( var j = 0, jj = preData.length; j < jj; ++j ) {
					sd = sufData[i],
					pd = preData[j];
					
					t = str.slice( pd.rm, -sd.rm || undef );
					
					if ( t ) {
						t = pd.add + t + sd.add;
						if ( callback( t, pd, sd ) === false ) {
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
