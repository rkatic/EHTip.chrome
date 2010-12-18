
var _options = {},
	tooltip,
	stayTimeoutId = null,
	lastRect = null,
	boxOutliner = null,
	howerWithShift,
	stayDelay,
	hold,
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
	hold = false;
	abort();
	
	options["tooltip.showRect"] = true;
	options["tooltip.onStay.withShift"] = true;
	
	for ( var name in options ) {
		if ( _options[name] === options[name] ) {
			continue;
		}
		
		var oldValue = _options[ name ];
		var newValue = options[ name ];
		
		switch ( name ) {
			case "tooltip.onStay":
				if ( newValue ) {
					if ( !tooltip ) tooltip = new Tooltip( document );
					window.addEventListener( 'mousemove', onMouseMove, false );
					window.addEventListener( 'scroll', abort, false );
				} else {
					window.removeEventListener( 'mousemove', onMouseMove, false );
					window.removeEventListener( 'scroll', abort, false );
				}
				break;
			case "tooltip.showRect":
				if ( newValue && !boxOutliner ) {
					boxOutliner = new BoxOutliner( document, "1px dashed red" );
					
				} else if ( !newValue ) {
					boxOutliner = null;
				}
				break;
				
		}
	}
	
	howerWithShift = options["tooltip.onStay.withShift"];
	stayDelay = howerWithShift ?
		options["tooltip.onStay.withShift.delay"] :
		options["tooltip.onStay.delay"];
	
	_options = options;
}

function handleLookupResponse( res ) {
	if ( res && res.length ) {
		putResultsInTooltip( res );
		tooltip.show( lastRect );
	}
}

function putResultsInTooltip( results ) {
	var toset = [];
	
	for ( var i = 0, l = results.length; i < l; ++i ) {
		if ( i !== 0 ) {
			toset.push( tooltip._sep_.cloneNode(false) );
		}
		
		var b = tooltip._b_.cloneNode(false);
		var t = results[i].term;
		if ( (results[i].parts || '').length > 1 ) {
			t = '(' + t + ')';
		}
		b.textContent = t;
		toset.push( b );
		
		t = ': ' + results[i].definitions.join(', ');
		toset.push( document.createTextNode( t ) );
	}
	
	tooltip.setContent( toset );
}

function abort() {
	if ( hold ) {
		return;
	}
	
	if ( stayTimeoutId ) {
		clearTimeout( stayTimeoutId );
		stayTimeoutId = null;
	}
	
	lastRect = null;
	reqProcess.abort();
	shrinkAnimation && shrinkAnimation.stop();
	
	if ( tooltip && tooltip.visible ) {
		tooltip.hide();
	}
	
	if ( boxOutliner && boxOutliner.visible ) {
		boxOutliner.hide();
	}
}


function onMouseMove( event ) {
	if ( hold || lastRect
		&& lastRect.left <= event.clientX && lastRect.right >= event.clientX
		&& lastRect.top <= event.clientY && lastRect.bottom >= event.clientY
	) { return; }
	
	abort();
	
	if ( !howerWithShift || event.shiftKey ) {
		recObject( lastEvent, event );
		stayTimeoutId = setTimeout( onMouseStay, stayDelay );
	}
}

function onMouseStay() {
	if ( lastEvent.target && !isEditable(lastEvent.target) ) {
		var range = getRangeAtXY( lastEvent.target, lastEvent.clientX, lastEvent.clientY );
		if ( range && isWord( range.toString() ) ) {
			//range.expand('word'); // breaks CLientRect...
			expandRangeByWord( range );
			var word = range.toString();
			lastRect = range.getBoundingClientRect();
			range.detach();
			boxOutliner && boxOutliner.show( lastRect );
			reqProcess.send(
				{
					type: "lookup",
					term: word,
					limit: _options["tooltip.limit"],
					exactsFirst: _options["tooltip.exactsFirst"]
				},
				handleLookupResponse
			);
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
	
	for ( var i = 0, l = childs.length; i < l; ++i ) {	
		if ( childs[i].nodeType !== 3 ) {
			continue;
		}
		
		range.selectNodeContents( childs[i] );
		if ( shrinkRangeToXY( range, x, y ) ) {
			return range;
		}
	}
	
	range.detach();
	return null;
}

var shrinkAnimation = null && (function(){
	var rects = [],
		timeoutId,
		outliner = new BoxOutliner( document, "3px dotted orange" );
	
	function play() {
		var rect = rects.unshift();
		if ( rect ) {
			outliner.show( rect );
			timeoutId = setTimeout( play, 200 );
		} else {
			stop();
		}
	}
	
	function stop() {
		if ( timeoutId ) {
			clearTimeout( timeoutId );
			timeoutId = null;
		}
		rects.length = 0;
		outliner.hide();
	}
	
	return {
		push: function( rect ) {
			rects.push( rect );
			!timeoutId && play();
		},
		stop: stop
	};
})();

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
	
	// range.isPointInRange ???
	var r = range.getBoundingClientRect();
	if ( r.left > x || r.right < x || r.top > y || r.bottom < y ) {
		return false;
	}
	
	shrinkAnimation && shrinkAnimation.push( r );
	
	var d = b - a;
	if ( d === 1 ) {
		return true;
	}
	
	var pivot = Math.floor( d / 2 ) + a;
	
	return shrinkRangeToXY( range, x, y, node, a, pivot )
		|| shrinkRangeToXY( range, x, y, node, pivot, b );
}

var reWordInclude = /^[\w\u00c0-\uFFFF\']+$/;
var reWordExclude = /\d/;

function expandRangeByWord( range ) {
	var node = range.startContainer,
		str = node.nodeValue,
		a = range.startOffset,
		b = a, n = str.length,
		c = str[a], pc = charCase(c),
		cc;
	
	for ( ; a > 0; --a ) {
		c = str[ a - 1 ];
		if ( reWordExclude.test(c) ) break;
		cc = charCase( c );
		if ( !cc && !reWordInclude.test(c) || pc == 1 && cc == -1 ) break;
		pc = cc;
	}
	
	for ( ; b < n; ++b ) {
		c = str[ b ];
		if ( reWordExclude.test(c) ) break;
		cc = charCase( c );
		if ( !cc && !reWordInclude.test(c) || pc == -1 && cc == 1 ) break;
		pc = cc;
	}

	//while ( a > 0 && re.test( str[a-1] ) ) --a;
	//while ( b < n && re.test( str[b] ) ) ++b;
	
	range.setStart( node, a );
	range.setEnd( node, b );
}

function isWord(s) {
	return reWordInclude.test(s) && !reWordExclude.test(s);
}

function charCase( c ) {
	var upper = c.toUpperCase();
	var lower = c.toLowerCase();
	return upper === lower ? 0 :
		c === upper ? 1 : -1;
}
