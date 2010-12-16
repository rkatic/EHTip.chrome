
var _options = {},
	tooltip;
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
					if ( !tooltip ) tooltip = new Tooltip();
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
	
	if ( tooltip && tooltip.visible ) {
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
	if ( lastEvent.target && !isEditable(lastEvent.target) ) {
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

function isEditable( elem ) {
	var name = elem.tagName.toLowerCase();
	
	if ( name === "input" || name === "textarea" ) {
		return true;
	}
	
	if ( document.designMode && document.designMode.toLowerCase() == "on" ) {
		return true;
	}
	
	while ( elem ) {
		if ( elem.isContentEditable ) {
			return true;
		}
		elem = elem.parentNode;
	}
	
	return false;
}

function recObject( dst, src ) {
	for ( var prop in dst ) {
		dst[ prop ] = src[ prop ];
	}
}

var reqProcess = (function(){
	var aborted = false, uid = 0;
	
	return {
		send: function( obj, callback, that ) {
			var id = ++uid;
			aborted = false;
			
			chrome.extension.sendRequest( obj, function() {
				if ( !aborted && id === uid ) {
					callback.apply( that, arguments );
				}
			});
		},
		
		abort: function() {
			aborted = true;
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
		if ( shrinkRangeToXY( range, x, y ) ) {
			return range;
		}
	}
	
	range.detach();
	return null;
}

// D&C
function shrinkRangeToXY( range, x, y, /* internals */ node, a, b ) {
	if ( node ) {
		range.setStart( node, a );
		range.setEnd( node, b );
		
	} else {
		node = range.startContainer;
		a = range.startOffset;
		b = range.endOffset;
		
		if ( a === b ) {
			return false;
		}
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

