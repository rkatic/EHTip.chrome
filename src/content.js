
var _options = {},
	stayTimeoutId = null,
	lastRect = null,
	lastEvent = {
		clientX: null,
		clientY: null,
		target: null,
		button: null
	};
	
chrome.extension.sendRequest( { type: "getOptions" }, handleOptions );

chrome.extension.onRequest.addListener(function( req, sender, send ) {
	switch ( req.type ) {
		case "options":
			handleOptions( req.options );
			send();
			break;
		
		default:
			send();
	}
});
	
function handleOptions( options ) {
	for ( var name in options ) {
		if ( _options[name] === options[name] ) {
			continue;
		}
		
		var oldValue = _options[ name ];
		var newValue = options[ name ];
		
		switch ( name ) {
			case "tooltip.onStay.enabled":
				if ( newValue ) {
					!tooltip.$box && tooltip.init();
					window.addEventListener('mousemove', onMouseMove, false);
					window.addEventListener('scroll', abort, false);
				} else {
					abort();
					window.removeEventListener('mousemove', onMouseMove, false);
					window.removeEventListener('scroll', abort, false);
				}
				break;
		}
	}
	
	_options = options;
}

function handleLookupResponse( res ) {
	if ( res && res.length ) {
		tooltip.setContent( res );
		tooltip.show( lastRect );
	}
}

function abort() {
	if ( stayTimeoutId ) {
		clearTimeout( stayTimeoutId );
		stayTimeoutId = null;
	}
	
	lastRect = null;
	reqProcess.abort();
	
	if ( tooltip.visible ) {
		tooltip.hide();
	}
}

function onMouseMove( event ) {
	if ( lastRect
		&& lastRect.left <= event.clientX && lastRect.right >= event.clientX
		&& lastRect.top <= event.clientY && lastRect.bottom >= event.clientY
	) { return; }
	
	abort();
	
	if ( _options['tooltip.onStay.enabled'] ) {
		recObject( lastEvent, event );
		stayTimeoutId = setTimeout( onMouseStay, _options['tooltip.onStay.delay'] );
	}
}

function onMouseStay() {
	if ( lastEvent.target ) {
		var range = getRangeAtXY( lastEvent.target, lastEvent.clientX, lastEvent.clientY );
		if ( range ) {
			//range.expand('word'); // breaks ranges...
			expandRangeByRe( range, reWord );
			var word = range.toString();
			lastRect = range.getBoundingClientRect();
			range.detach();
			reqProcess.send({ type: "lookup", term: word }, handleLookupResponse);
		}
	}
}

function detach( node ) {
	node.parentNode && node.parentNode.removeChild( node );
}

var tooltip = {
	init: function() {
		var s;
		
		this.$box = this._create('div');
		s = this.$box.style;
		s.zIndex = "99991";
		s.position = "absolute";
		s.background = "transparent";
		
		this.$content = this._create('div');
		s = this.$content.style;
		s.background = "#ffffbf";
		s.border = "2px solid #e1c642";
		s.color = "#000";
		s.opacity = ".96";
		s.padding = "7px";
		s.maxWidth = "250px";
		s.zIndex = "99992";
		s.setProperty && s.setProperty("-webkit-border-radius", "5px", null);
		s.setAttribute && s.setAttribute("border-radius", "5px");
		this.$box.appendChild( this.$content );
		
		this.$b = this._create('b');
		this.$br = this._create('br');
		
		this.$up = this._createArrow("up");
		this.$down = this._createArrow("down");
	},
	
	_createArrow: function( dir ) {
		var s, t = this.$box.cloneNode(false);
		
		var inner = t.cloneNode(false);
		s = inner.style;
		s.borderLeft = "9px solid transparent";
		s.borderRight = "9px solid transparent";
		s.left = "3px";
		s.zIndex = "99998";
		if ( dir === "up" )  {
			s.borderBottom = "9px solid #ffffbf";
			s.top = "3px"
		} else {
			s.borderTop = "9px solid #ffffbf";
		}
		
		var outher = t.cloneNode(false);
		s = outher.style;
		s.borderLeft = "12px solid transparent";
		s.borderRight = "12px solid transparent";
		s.left = "0px";
		s.zIndex = "99997";
		if ( dir === "up" ) {
			s.borderBottom = "12px solid #e1c642"
		} else {
			s.borderTop = "12px solid #e1c642";
		}
		
		var arrow = t.cloneNode(false);
		arrow.style.zIndex = "99996";
		arrow.appendChild( inner );
		arrow.appendChild( outher );
		
		return arrow;
	},
	
	_create: function( name ) {
		var elem = document.createElement( name );
		var s = elem.style;
		
		s.border = "0";
		s.color = "#000";
		s.margin = "0";
		s.padding = "0";
		s.fontFamily = "arial, sans-serif";
		s.fontSize = "13px";
		s.fontStyle = "normal";
		s.fontVariant = "normal";
		s.fontWeight = "normal";
		s.height = "auto";
		s.lineHeight = "normal";
		s.textAlign = "left";
		s.width = "auto";
		s.direction = "ltr";
		
		switch ( name ) {
			case "div":
				s.display = "block";
				break;
			case "a":
				s.display = "inline";
				s.textDecoration = "underline";
				s.fontSize = "11px";
				elem.target = "_blank"
				break;
			case "b":
				s.fontWeight = "bold";
				break;
		}
		
		return elem;
	},
	
	hide: function() {
		detach( this.$box );
		detach( this.$up );
		detach( this.$down );
		this.visible = false;
	},
	
	setContent: function( list ) {
		this.$content.innerHTML = '';
		
		for ( var i = 0, l = list.length; i < l; ++i ) {
			if ( i !== 0 ) {
				this.$content.appendChild( this.$br.cloneNode(false) );
			}
			
			var b = this.$b.cloneNode(false);
			var t = list[i].term;
			if ( (list[i].parts || '').length > 1 ) {
				t = '(' + t + ')';
			}
			b.textContent = t;
			this.$content.appendChild( b );
			
			t = ': ' + list[i].definitions.join(', ');
			this.$content.appendChild(  document.createTextNode( t ) );
		}
	},
	
	show: function( rect ) {
		var box = this.$box;			
		
		box.style.visibility = "hidden";
		box.style.top = '0';
		box.style.left = '0';
		
		document.body.appendChild( box );
		
		var boxW = box.offsetWidth;
		var boxH = box.offsetHeight;
		
        var scrollLeft = document.documentElement.scrollLeft + document.body.scrollLeft;
        var scrollTop = document.documentElement.scrollTop + document.body.scrollTop;
		
		var viewW = window.innerWidth;
		var viewH = window.innerHeight;
		
		if ( scrollTop || document.body.offsetHeight >= viewH ) {
			viewW -= 20;
		}
		
		if ( scrollLeft || document.body.offsetWidth >= window.innerWidth ) {
			viewH -= 20;
		}
		
		var x = Math.round( (rect.left + rect.right) / 2 );
		
		var arrow;
		var boxY = rect.top - 10 - boxH;
		var boxX = x - Math.round( boxW / 2 );
		
		var dx = boxX + boxW - viewW;
		if ( dx > 0 ) boxX -= dx;
		if ( boxX < 0 ) boxX = 0;
		
		if ( boxY >= 0 ) {
			arrow = this.$down;
			arrow.style.top = rect.top - 12 + scrollTop + "px";
		} else {
			boxY = rect.bottom + 10;
			if ( boxY + boxH > viewH ) {
				boxY = 0;
			} else {
				arrow = this.$up;
				arrow.style.top = rect.bottom + scrollTop + "px";
			}
		}
		
		box.style.top = boxY + scrollTop + 'px';
		box.style.left = boxX + scrollLeft + 'px';
		box.style.visibility = "visible";
		
		if ( arrow ) {
			arrow.style.left = x - 12 + scrollLeft + 'px';;
			document.body.appendChild( arrow );
		}
		
		this.visible = true;
	}
};

function recObject( dst, src ) {
	for ( var prop in dst ) {
		dst[ prop ] = src[ prop ];
	}
}

var reqProcess = (function(){
	var uid = 0;
	
	return {
		send: function( obj, callback, that ) {
			var id = ++uid;
			
			chrome.extension.sendRequest( obj, function() {
				if ( id === uid ) {
					callback.apply( that, arguments );
				}
			});
		},
		
		abort: function() {
			++uid;
		}
	};
})();


function getRangeAtXY( parent, x, y ) {
	var range = document.createRange(),
		childs = parent.childNodes;
	
	for ( var i = 0, child; ( child = childs[i] ); ++i ) {		
		if ( child.nodeType !== 3 ) {
			continue;
		}
		
		range.selectNodeContents( child );
		if ( shrinkRangeToXY(range, x, y, child) ) {
			return range;
		}
	}
	
	range.detach();
	return null;
}

// D&C
function shrinkRangeToXY( range, x, y, node, a, b ) {
	if ( a == null ) {
		a = range.startOffset;
		b = range.endOffset;
		
		if ( a === b ) {
			return false;
		}
	} else {
		range.setStart( node, a );
		range.setEnd( node, b );
	}
	
	var r = range.getBoundingClientRect();
	if ( r.left > x || r.right < x || r.top > y || r.bottom < y ) {
		return false;
	}
	
	var d = b - a;
	if ( d === 1 ) {
		return true;
	}
	
	var pivot = Math.floor( d / 2 ) + a;
	
	return shrinkRangeToXY( range, x, y, node, a, pivot )
		|| shrinkRangeToXY( range, x, y, node, pivot, b );
}

var reWord = /^[\w\u00c0-\uFFFF\']+$/;

function expandRangeByRe( range, re ) {
	var node = range.startContainer,
		str = node.nodeValue,
		a = range.startOffset,
		b = a, n = str.length;
	
	 while ( a > 0 && re.test( str[a-1] ) ) --a;
	 while ( b < n && re.test( str[b] ) ) ++b;
	 
	 range.setStart( node, a );
	 range.setEnd( node, b );
}

