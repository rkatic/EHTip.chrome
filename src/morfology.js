module('morfology', function( exports, require, module ) {

	var utils = require("utils"),
		io = require("io"),

		extend = utils.extend,

		reGetIndex = /^([^\\(]*)\(([^-[\]{}()*+?.,\\^$#\s]+)\)([^\\(]*)$/;

	function insertTransformation( dst, index, pattern, add ) {
		var indexes = index.split('|');
		var r = {
			re: pattern && new RegExp( pattern ),
			add: add || ""
		};

		for ( var i = 0; i < indexes.length; ++i ) {
			var key = indexes[i];
			var len = key.length;
			var map = dst[len] || ( dst[len] = {} );
			var values = map[ key+' ' ];

			if ( values ) {
				values.push( r );
			} else {
				map[ key+' ' ] = [ r ];
			}
		}
	}

	function findTransitions( T, isSfx, term, fun, funContext ) {
		var maxKeyLen = Math.min( T.length, term.length ) - 1;
		var keyLen = 1;
		var key = "", value = "";
		var map, array = T[0] && T[0][" "], m, t;
		var i = 0;
		var defaultM = [" "];

		if ( array ) {
			for ( i = 0; i < array.length; ++i ) {
				t = array[i];

				m = t.re ? t.re.exec( term ) : defaultM;

				if ( m ) {
					fun.call( funContext, term, m[0].length, m[1] || "", t.add );
				}
			}
		}

		for ( ; keyLen <= maxKeyLen; ++keyLen ) {
			map = T[ keyLen ];
			if ( !map ) continue;

			key = isSfx ?
				term.slice( -keyLen ) :
				term.substr( 0, keyLen );

			array = map[ key+' ' ];
			if ( !array ) continue;

			value = isSfx ?
				term.slice( 0, -keyLen ):
				term.substr( keyLen );

			for ( i = 0; i < array.length; ++i ) {
				t = array[i];

				m = t.re ? t.re.exec( value ) : defaultM;

				if ( m ) {
					fun.call( funContext, term, m[0].length + keyLen, key, t.add );
				}
			}
		}
	}

	function _appendSfxResult_( term, inspected, rm, add ) {
		this.push({
			inspectedRight: inspected,
			removedFromRight: rm,
			addedToRight: add,
			value: term.slice( 0, -rm.length || void 0 ) + add
		});
	}

	function _appendPfxResult_( term, inspected, rm, add ) {
		this.push({
			inspectedLeft: inspected,
			removedFromLeft: rm,
			addedToLeft: add,
			value: add + term.substr( rm.length )
		});
	}

	function Transformations() {
		this._sfx = [];
		this._pfx = [];
	}

	module.Class( Transformations, {

		addPrefixTransformation: function( pattern, prefix ) {
			var index = "", m = reGetIndex.exec( pattern );

			if ( m && !m[1] ) {
				index = m[2];
				pattern = m[3];
			}

			if ( pattern === '.' ) {
				pattern = null;
			} else if ( pattern ) {
				pattern = '^' + pattern + ( pattern.slice(-1) === '.' ? '' : '.' );
			}

			insertTransformation( this._pfx, index, pattern, prefix );
		},

		addSuffixTransforamtion: function( pattern, suffix ) {
			var index = "", m = reGetIndex.exec( pattern );

			if ( m && !m[3] ) {
				index = m[2];
				pattern = m[1];
			}

			if ( pattern === '.' ) {
				pattern = null;
			} else if ( pattern ) {
				pattern = ( pattern[0] === '.' ? '' : '.' ) + pattern + '$';
			}

			insertTransformation( this._sfx, index, pattern, suffix );
		},

		generate: function( str ) {
			var results = [], t, r,
				i = 0, j = 0, sfxLen, pfxLen,
				sfx, pfx;

			findTransitions( this._sfx, true, str, _appendSfxResult_, results );
			sfxLen = results.length;
			findTransitions( this._pfx, false, str, _appendPfxResult_, results );
			pfxLen = results.length - sfxLen;

			if ( sfxLen > 0 && pfxLen > 0 ) {
				for ( i = 0; i < sfxLen; ++i ) {
					sfx = results[i];
					for ( j = sfxLen; j < pfxLen; ++j ) {
						pfx = results[j];

						t = str.slice( pfx.removedFromLeft.length, -sfx.removedFromRight.length || void 0 );

						if ( t ) {
							r = extend( extend( {}, sfx ), pfx );
							r.value = pfx.addedToLeft + t + sfx.addedToRight;
							results.push( r );
						}
					}
				}
			}

			return results;
		}
	});

	Transformations.fromFile = function( path ) {
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
