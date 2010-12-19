
var _options = {},
	_tooltip,
	_stayTimeoutId = null,
	_lastRect = null,
	_boxOutliner = null,
	_stayOnlyWithShift,
	_selectOnlyWithShift,
	_stayDelays,
	_noTooltipArrow,
	_holdNext,
	_hold,
	_ignoreNextMouseUp,
	_lastEvent = {
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
	_hold = false;
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
				_stayOnlyWithShift = ( newValue === 1 );
				applyListiners( howerListiners, newValue );
			
			case "tooltip.onStay.delay":
			case "tooltip.onStay.withShift.delay":
				_stayDelays = [
					options["tooltip.onStay.delay"],
					options["tooltip.onStay.withShift.delay"]
				];
				break;
				
			case "tooltip.onSelect":
				_selectOnlyWithShift = ( newValue === 1 );
				applyListiners( selectListiners, newValue );
				break;
			
			case "tooltip.showRect":
				if ( newValue && !_boxOutliner ) {
					_boxOutliner = new BoxOutliner( document, "1px dashed red" );
					
				} else if ( !newValue ) {
					_boxOutliner = null;
				}
				break;
				
		}
	}

	_tooltip = options["tooltip.onStay"] || options["tooltip.onSelect"] ?
		( _tooltip || new Tooltip( document ) ) : null;
	
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
		if ( _holdNext ) {
			_hold = true;
			_holdNext = false;
		}
		putResultsInTooltip( res );
		_tooltip.show( _lastRect, _options["tooltip.preferedPosition"], _noTooltipArrow );
	}
}

function putResultsInTooltip( results ) {
	var span, t, b,
		w = _tooltip.createElement('div');
	
	if ( _hold ) {
		span = _tooltip.createElement('span');
		span.style.cursor = "pointer";
		applyListiners.call( _tooltip._content, tooltipOnHoldListiners, true );
	}
	
	for ( var i = 0, l = results.length; i < l; ++i ) {
		if ( i !== 0 ) {
			w.appendChild( _tooltip._sep_.cloneNode(false) );
		}
		
		b = _tooltip._b_.cloneNode(false);
		t = results[i].term;
		if ( (results[i].parts || '').length > 1 ) {
			t = '(' + t + ')';
		}
		b.textContent = t;
		w.appendChild( b );
		
		if ( _hold ) {
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
	
	_tooltip.setContent( w );
}

function abort() {
	if ( _hold ) {
		return;
	}
	
	if ( _stayTimeoutId ) {
		clearTimeout( _stayTimeoutId );
		_stayTimeoutId = null;
	}
	
	_lastRect = null;
	_holdNext = false;
	_noTooltipArrow = false;
	reqProcess.abort();
	shrinkAnimation && shrinkAnimation.stop();
	
	if ( _tooltip && _tooltip.visible ) {
		_tooltip.hide();
	}
	
	if ( _boxOutliner && _boxOutliner.visible ) {
		_boxOutliner.hide();
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
	if ( _hold || _lastRect
		&& _lastRect.left <= event.clientX && _lastRect.right >= event.clientX
		&& _lastRect.top <= event.clientY && _lastRect.bottom >= event.clientY
	) { return; }
	
	abort();
	
	if ( !_stayOnlyWithShift || event.shiftKey ) {
		recObject( _lastEvent, event );
		_stayTimeoutId = setTimeout( onMouseStay, _stayDelays[event.shiftKey*1] );
	}
}
};

function onMouseStay() {
	if ( _lastEvent.target && !isEditable(_lastEvent.target) ) {
		var range = getRangeAtXY( _lastEvent.target, _lastEvent.clientX, _lastEvent.clientY );
		if ( range && isWord( range.toString() ) ) {
			//range.expand('word'); // breaks CLientRect...
			expandRangeByWord( range );
			var word = range.toString();
			_lastRect = range.getBoundingClientRect();
			range.detach();
			_boxOutliner && _boxOutliner.show( _lastRect );
			lookup( word );
		}
	}
}


var selectListiners = {
"mousedown": function( event ) {
	if ( _hold && !_tooltip._content.contains(event.target)  ) {
		_hold = false;
		abort();
	}
},
"mouseup": function( event ) {
	if ( _ignoreNextMouseUp ) {
		_ignoreNextMouseUp = false;
		return;
	}
	if ( event.button === 0 && (!_selectOnlyWithShift || event.shiftKey) ) {
		recObject( _lastEvent, event );
		setTimeout( onSelected, 1 );
	}
}
};

function onSelected() {
	var selection = window.getSelection();
	var selected = selection.toString();
	if ( selected && selected.length < 50 ) {
		if ( selection.isCollapsed ) {
			_lastRect = new PointRect( _lastEvent.clientX, _lastEvent.clientY, 10 );
		} else {
			var range = selection.getRangeAt(0);
			_lastRect = range.getBoundingClientRect();
			range.detach();
		}
		_holdNext = true;
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
	_ignoreNextMouseUp = true;
	var name = event.target.tagName.toLowerCase();
	if ( name === "b" || name === "span" ) {
		if ( event.ctrlKey || event.shiftKey ) {
			_noTooltipArrow = true;
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
