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
				//remove: /^\([^?)]/.test( pattern ),
				add: prefix
			});
		},
		
		addSuffixTransforamtion: function( pattern, suffix ) {
			if ( pattern.charAt(0) !== '.' ) {
				pattern = '.' + pattern;
			}
			
			this._sfx.push({
				re: new RegExp( pattern + '$' ),
				//remove: /\([^?].*?\)$/.test( pattern ),
				add: suffix
			});
		},
		
		generateAll: function( str ) {
			var results = [];
			
			this.generate( str, function( term, defs, parts ) {
				results.push({
					term: term,
					parts: parts
				});
			});
			
			return results;
		},
		
		generate: function( str, callback ) {			
			var sufData = [], preData = [], arr, t, remove, data, suffix, prefix, mid;
			
			arr = this._sfx;
			for ( var i = 0, l = arr.length; i < l; ++i ) {
				if ( arr[i].re.test( str ) ) {
					data = { remove: RegExp.$1 };
					suffix = '';
					mid = str;
					t = arr[i];
					
					if ( data.remove ) {
						mid = str.slice( 0, -data.remove.length );
					}
					
					if ( t.add ) {
						suffix = t.add;
						data.add = suffix;
					}
					
					sufData.push( data );
					
					if ( callback( mid + suffix, [ mid, suffix ] ) === false ) {
						return;
					}
				}
			}
			
			arr = this._pfx;
			for ( var i = 0, l = arr.length; i < l; ++i ) {
				if ( arr[i].re.test( str ) ) {
					data = { remove: RegExp.$1 };
					mid = str;
					prefix = '';
					t = arr[i];
					
					if ( data.remove ) {
						mid = str.substr( data.remove.length );
					}
					
					if ( t.add ) {
						prefix = t.add;
						data.add = prefix;
					}
					
					preData.push( data );
					
					if ( callback( prefix + mid, [ prefix, mid ] ) === false ) {
						return;
					}
				}
			}
			
			if ( sufData.length === 0 || preData.length === 0 ) {
				return;
			}

			for ( var i = 0, ii = sufData.length; i < ii; ++i ) {
				for ( var j = 0, jj = preData.length; j < jj; ++j ) {
					suffix = sufData[i].add || '';
					prefix = preData[j].add || '';
					mid = str;
					
					if ( preData[j].remove ) {
						mid = mid.substr( preData[j].remove.length );
					}
					
					if ( sufData[i].remove ) {
						mid = mid.slice( 0, -sufData[i].remove.length );
					}
					
					if ( callback( prefix + mid + suffix, [ prefix, mid, suffix ] ) === false ) {
						return;
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
