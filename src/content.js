
var _options = {},
	tooltip,
	stayTimeoutId = null,
	lastRect = null,
	boxOutliner = null,
	stayOnlyWithShift,
	selectOnlyWithShift,
	stayDelays,
	noTooltipArrow,
	holdNext,
	hold,
	ignoreNextMouseUp,
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
	
	for ( var name in options ) {
		if ( _options[name] === options[name] ) {
			continue;
		}
		
		var oldValue = _options[ name ];
		var newValue = options[ name ];
		
		switch ( name ) {
			case "tooltip.onStay":
				stayOnlyWithShift = ( newValue === 1 );
				applyListiners( howerListiners, newValue );
			
			case "tooltip.onStay.delay":
			case "tooltip.onStay.withShift.delay":
				stayDelays = [
					options["tooltip.onStay.delay"],
					options["tooltip.onStay.withShift.delay"]
				];
				break;
				
			case "tooltip.onSelect":
				selectOnlyWithShift = ( newValue === 1 );
				applyListiners( selectListiners, newValue );
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

	tooltip = options["tooltip.onStay"] || options["tooltip.onSelect"] ?
		( tooltip || new Tooltip( document ) ) : null;
	
	_options = options;
}

function lookup( term, callback ) {
	reqProcess.send(
		{
			type: "lookup",
			term: term,
			limit: _options["tooltip.limit"],
			exactsFirst: _options["tooltip.exactsFirst"]
		},
		callback || handleLookupResponse
	);
}

function handleLookupResponse( res ) {
	if ( res && res.length ) {
		if ( holdNext ) {
			hold = true;
			holdNext = false;
		}
		putResultsInTooltip( res );
		tooltip.show( lastRect, _options["tooltip.preferedPosition"], noTooltipArrow );
	}
}

function putResultsInTooltip( results ) {
	var span, t, b,
		w = tooltip.createElement('div');
	
	if ( hold ) {
		span = tooltip.createElement('span');
		span.style.cursor = "pointer";
		applyListiners.call( tooltip._content, tooltipOnHoldListiners, true );
	}
	
	for ( var i = 0, l = results.length; i < l; ++i ) {
		if ( i !== 0 ) {
			w.appendChild( tooltip._sep_.cloneNode(false) );
		}
		
		b = tooltip._b_.cloneNode(false);
		t = results[i].term;
		if ( (results[i].parts || '').length > 1 ) {
			t = '(' + t + ')';
		}
		b.textContent = t;
		w.appendChild( b );
		
		if ( hold ) {
			w.appendChild( document.createTextNode(': ') );
			var defs = results[i].definitions;
			for ( var j = 0, n = defs.length; j < n; ++j ) {
				if ( j !== 0 ) {
					w.appendChild( document.createTextNode(', ') );
				}
				t = span.cloneNode(false);
				t.textContent = defs[j];
				w.appendChild( t );
			}
		} else {
			t = ': ' + results[i].definitions.join(', ');
			w.appendChild( document.createTextNode( t ) );
		}
	}
	
	tooltip.setContent( w );
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
	holdNext = false;
	noTooltipArrow = false;
	reqProcess.abort();
	shrinkAnimation && shrinkAnimation.stop();
	
	if ( tooltip && tooltip.visible ) {
		tooltip.hide();
	}
	
	if ( boxOutliner && boxOutliner.visible ) {
		boxOutliner.hide();
	}
}

function applyListiners( map, add ) {
	var target = this || window; // ES5..
	var action = add ? 'addEventListener' : 'removeEventListener';
	for ( var type in map ) {
		target[ action ]( type, map[type], false );
	}
}

function PointRect( x, y, r ) {
	this.left = x - r;
	this.right = x + r;
	this.top = y - r;
	this.bottom = y + r;
	this.height = r + r;
	this.width = r + r;
}


var howerListiners = {
"scroll": abort,
"mousemove": function( event ) {
	if ( hold || lastRect
		&& lastRect.left <= event.clientX && lastRect.right >= event.clientX
		&& lastRect.top <= event.clientY && lastRect.bottom >= event.clientY
	) { return; }
	
	abort();
	
	if ( !stayOnlyWithShift || event.shiftKey ) {
		recObject( lastEvent, event );
		stayTimeoutId = setTimeout( onMouseStay, stayDelays[event.shiftKey*1] );
	}
}
};

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
			lookup( word );
		}
	}
}


var selectListiners = {
"mousedown": function( event ) {
	if ( hold && !tooltip._content.contains(event.target)  ) {
		hold = false;
		abort();
	}
},
"mouseup": function( event ) {
	if ( ignoreNextMouseUp ) {
		ignoreNextMouseUp = false;
		return;
	}
	if ( event.button === 0 && (!selectOnlyWithShift || event.shiftKey) ) {
		recObject( lastEvent, event );
		setTimeout( onSelected, 1 );
	}
}
};

function onSelected() {
	var selection = window.getSelection();
	var selected = selection.toString();
	if ( selected && selected.length < 50 ) {
		if ( selection.isCollapsed ) {
			lastRect = new PointRect( lastEvent.clientX, lastEvent.clientY, 10 );
		} else {
			var range = selection.getRangeAt(0);
			lastRect = range.getBoundingClientRect();
			range.detach();
		}
		holdNext = true;
		lookup( selected );
	}
}

var tooltipOnHoldListiners = {
"mouseout": function( event ) {
	if ( event.target.tagName.toLowerCase() === "span" ) {
		event.target.style.textDecoration = "none";
	}
	if ( event.relatedTarget.tagName.toLowerCase() === "span" ) {
		event.relatedTarget.style.textDecoration = "underline";
	}
},
"mousedown": function( event ) {
	event.preventDefault();
	event.stopPropagation();
	ignoreNextMouseUp = true;
	var name = event.target.tagName.toLowerCase();
	if ( name === "b" || name === "span" ) {
		if ( event.ctrlKey || event.shiftKey ) {
			noTooltipArrow = true;
			lookup( event.target.textContent );
		
		} else {
			setSelection( event.target.textContent );
		}
	}
}
};

function setSelection( text ) {
	console.log( text );
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
