module('morfology', function( exports, require ) {
	
	var utils = require("utils"),
		io = require("io");
	
	var reSplitWords = /(?:[^\w\u00c0-\uFFFF\']|[\d“”_])+/g;

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
		
		generate: function( str, callback ) {			
			var sufData = [], preData = [], arr, rm, t, undef;
			
			var first, last, mid, left = "", right = "",
				words = str.split( reSplitWords );
			
			if ( words.length === 1 ) {
				first = last = str;
			} else {
				first = words[0];
				last = words[ words.length - 1 ];
				mid = str.slice( first.length, -last.length || undef );
				left = first + mid;
				right = mid + last;
			}
			
			arr = this._sfx;
			for ( var i = 0, l = arr.length; i < l; ++i ) {
				if ( arr[i].re.test( last ) ) {
					rm = RegExp.$1 ? RegExp.$1.length : 0;
					add = arr[i].add || "";
					
					t = ( rm ? last.slice( 0, -rm ) : last ) + add;
					
					sufData.push({
						rm: rm,
						add: add,
						right: t
					});
					
					if ( callback( left + t ) === false ) {
						return;
					}
				}
			}
			
			arr = this._pfx;
			for ( var i = 0, l = arr.length; i < l; ++i ) {
				if ( arr[i].re.test( first ) ) {
					rm = RegExp.$1 ? RegExp.$1.length : 0;
					add = arr[i].add || "";
					
					t = add + ( rm ? first.substr( rm ) : first );
					
					preData.push({
						rm: rm,
						add: add,
						left: t
					});
					
					if ( callback( t + right ) === false ) {
						return;
					}
				}
			}
			
			if ( sufData.length === 0 || preData.length === 0 ) {
				return;
			}

			for ( var i = 0, ii = sufData.length; i < ii; ++i ) {
				for ( var j = 0, jj = preData.length; j < jj; ++j ) {
					var sd = sufData[i], pd = preData[j];
					t = undef;
					
					if ( mid ) {
						t = pd.left + mid + sd.right;
						
					} else {
						t = str.slice( pd.rm, -sd.rm || undef );
						
						if ( t ) {
							t = pd.add + t + sd.add;
						}
					}
					
					if ( t && callback( t ) === false ) {
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
