module("content", function( exports, require ) {
	
var shapes = require("shapes");
	
var	window = this,
	document = window.document,
	_options = {
		"tooltip.onStay": 0,
		"tooltip.onSelect": 0
	},
	_tooltip,
	_stayTimeoutId = null,
	_rect = null,
	_boxOutliner = null,
	_stayMode,
	_selectMode,
	_stayDelays,
	_noTooltipArrow,
	_nextHold,
	_hold,
	_ignoreNextMouseUp,
	_event = {
		clientX: null,
		clientY: null,
		target: null,
		button: null,
		shiftKey: null
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
	ABORT();
	
	if ( options["tooltip.enabled"] ) {
		_tooltip = _tooltip || new shapes.Tooltip( document );
	} else {
		_tooltip = null;
		options["tooltip.onStay"] = 0;
		options["tooltip.onSelect"] = 0;
	}
	
	for ( var name in options ) {
		if ( _options[name] === options[name] ) {
			continue;
		}
		
		var oldValue = _options[ name ];
		var newValue = options[ name ];
		
		switch ( name ) {
			case "tooltip.onStay":
				_boxOutliner = newValue ?
					new shapes.BoxOutliner( document, "1px dashed red" ) :
					null;
				
				_stayMode = newValue;
				applyListiners( window, newValue, howerListiners );
			
			case "tooltip.onStay.delay":
			case "tooltip.onStay.withShift.delay":
				_stayDelays = [
					options["tooltip.onStay.delay"],
					options["tooltip.onStay.withShift.delay"]
				];
				break;
				
			case "tooltip.onSelect":
				_selectMode = newValue;
				applyListiners( window, newValue, selectListiners );
				break;
				
		}
	}
	
	_options = options;
}

function lookup( term, callback ) {
	reqProcess.send(
		{
			type: "lookup",
			term: term,
			limit: _options["tooltip.limit"]
		},
		callback || handleLookupResponse
	);
}

function handleLookupResponse( res ) {
	if ( res && res.length ) {
		_hold = _nextHold;
		putResultsInTooltip( res );
		_tooltip.show( _rect, _options["tooltip.preferedPosition"], _noTooltipArrow );
	}
	
	_noTooltipArrow = false;
	_nextHold = false;
}

function putResultsInTooltip( results ) {
	var span, t, b,
		w = _tooltip.createElement('div');
	
	if ( _hold ) {
		span = _tooltip.createElement('span');
		span.style.cursor = "pointer";
		span.style.color = "blue";
		applyListiners( _tooltip._content, true, tooltipListiners );
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
	
	_rect = null;
	_nextHold = false;
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

function ABORT() {
	_hold = false;
	abort();
}

function applyListiners( target, add, map ) {
	var action = add ? 'addEventListener' : 'removeEventListener';
	for ( var type in map ) {
		target[ action ]( type, map[type], true );
	}
}


var howerListiners = {
"scroll": abort,
"mousemove": function( event ) {
	if ( _rect && isRectOverPoint(_rect, event.clientX, event.clientY) ) {
		return;
	}
	
	abort();
	
	if ( event.shiftKey || !_hold && _stayMode > 1 ) {
		recObject( _event, event );
		_stayTimeoutId = window.setTimeout( onMouseStay, _stayDelays[event.shiftKey*1] );
	}
}
};

function onMouseStay() {
	if ( _event.target && !isEditable(_event.target) ) {
		var range = getRangeAtXY( _event.target, _event.clientX, _event.clientY );
		if ( !range ) return;
		
		var node = range.startContainer;
		var str = node.textContent;
		var offset = range.startOffset;
		var a, b, aj, bj, boxRect, rect;
		var term, leftWord, rightWord;
		
		var overChar = isWord( str[offset] );
		
		if ( overChar ) {
			a = wordBound( str, offset, -1 );
			b = wordBound( str, offset, 1 );
			
			range.setStart( node, a );
			range.setEnd( node, b );
			
			term = range.toString();
			//term = str.substring( a, b );
		} else {
			a = range.startOffset;
			b = range.endOffset;	
		}
		
		if ( overChar ) {
			rect = range.getBoundingClientRect();
		}
		
		aj = passLeftWordJoiner( str, a );
		bj = passRightWordJoiner( str, b );
		
		if ( !overChar ) {
			rect = range.getBoundingClientRect();
		}
		
		if ( aj !== -1 ) {
			a = wordBound( str, aj, -1 );
			leftWord = str.substring( a, aj );
		}
		
		if ( bj !== -1 ) {
			b = wordBound( str, bj, 1 );
			rightWord = str.substring( bj, b );
		}
		
		if ( overChar ) {
			boxRect = rect;
			
			if ( leftWord || rightWord ) {
				term = trisCombinations( leftWord, term, rightWord );
			}
			
		} else if ( leftWord && rightWord ) {
			range.setStart( node, a );
			range.setEnd( node, b );
			boxRect = range.getBoundingClientRect();
			
			term = leftWord + ' ' + rightWord;
			
		}
		
		range.detach();
		
		if ( term ) {
			
			ABORT();
			
			_rect = rect;
			_event.shiftKey && _boxOutliner.show( boxRect );
			shrinkAnimation && shrinkAnimation.play();
			//console.log( term );
			lookup( term );
		}
	}
}


var selectListiners = {
"mousedown": function( event ) {
	if ( _hold && !_tooltip._content.contains(event.target)  ) {
		ABORT();
	}
},
"mouseup": function( event ) {
	if ( _ignoreNextMouseUp ) {
		event.preventDefault();
		event.stopPropagation();
		_ignoreNextMouseUp = false;
		return;
	}
	if ( event.button === 0 && (_selectMode > 1 || event.shiftKey) ) {
		recObject( _event, event );
		window.setTimeout( onSelected, 1 );
	}
}
};

function onSelected() {
	var selection = getSelectionFrom( _event.target );
	var selected = selection.toString();
	if ( selected && selected.length < 50 ) {
		if ( isInputElement(_event.target) || _event.target.contentDocument ) {
			_rect = new PointRect( _event.clientX, _event.clientY, 10 );
			_noTooltipArrow = true;
		} else {
			var range = selection.getRangeAt(0);
			_rect = range.getBoundingClientRect();
			range.detach();
		}
		_nextHold = true;
		lookup( selected );
	}
}

var tooltipListiners = {
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
		if ( event.ctrlKey || event.button === 1 ) {
			_noTooltipArrow = true;
			_nextHold = true;
			lookup( event.target.textContent );
		
		} else {
			setSelection( event.target.textContent );
			ABORT();
		}
	}
}
};

function getSelectionFrom( node ) {
	return node.contentDocument ?
		node.contentDocument.getSelection() :
		node.ownerDocument.getSelection();
}

function setSelection( text ) {
	var selection = getSelectionFrom( _event.target ),
		selected = selection.toString(),
		node, a, b, t, spaceLeft, spaceRight, value;
	
	if ( !selected ) {
		return;
	}
	
	spaceLeft = selected.match(/^(\s*)/)[1];
	spaceRight = selected.match(/(\s*)$/)[1];
	selected = selected.slice( spaceLeft.length, -spaceRight.length || selected.length );
	text = spaceLeft + toSameCaseAs( text, selected ) + spaceRight;
	
	if ( !isInputElement(_event.target) ) {
		node = selection.anchorNode;
		value = node.textContent;
		a = selection.anchorOffset;
		b = ( node === selection.focusNode ) ? selection.focusOffset : a;
		if ( b < a ) {
			t = a;
			a = b;
			b = t;
		}
		node.textContent = value.substring(0, a) + text + value.substring(b);
		selection.collapse( node, a + text.length );
		try {
			node.focus();
		} catch (e) {}
		
	} else {
		node = _event.target;
		value = node.value;
		a = node.selectionStart;
		b = node.selectionEnd;
		var scrollTop = node.scrollTop;
		var scrollLeft = node.scrollLeft;
		node.value = value.substring(0, a) + text + value.substring(b);
		node.selectionStart = node.selectionEnd = ( a + text.length );
		node.focus();
		node.scrollTop = scrollTop;
		node.scrollLeft = scrollLeft;
	}
}

function toSameCaseAs( str, sample ) {
	if ( sample.toLowerCase() === sample ) {
		return str.toLowerCase();
	}
	if ( sample.toUpperCase() === sample && sample.length > 1 ) {
		return str.toUpperCase();
	}
	if ( sample[0].toUpperCase() === sample[0] ) {
		return str[0].toUpperCase() + str.substr(1).toLowerCase();
	}
	return str;
}

function isInputElement( elem ) {
	var name = elem.nodeName.toLowerCase();
	return ( name === "input" || name === "textarea" );
}


function isEditable( elem ) {
	if ( isInputElement(elem) ) {
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
	var rects = [], started,
		timeoutId,
		outliner = new shapes.BoxOutliner( document, "2px dotted orange" );
	
	function play() {
		started = true;
		var rect = rects.shift();
		if ( rect ) {
			outliner.show( rect );
			timeoutId = window.setTimeout( play, 300 );
		} else {
			stop();
		}
	}
	
	function stop() {
		if ( !started ) {
			return;
		}
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
			started = false;
		},
		play: play,
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
	shrinkAnimation && shrinkAnimation.push( r );
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


function isRectOverPoint( r, x, y ) {
	return !( r.left > x || r.right < x || r.top > y || r.bottom < y );
}

function MovedRect( r, x, y ) {
	this.top = r.top + y;
	this.right = r.right + x;
	this.bottom = r.bottom + y;
	this.right = r.right + x;
	this.height = r.height;
	this.width = r.width;
}

function PointRect( x, y, r ) {
	this.left = x - r;
	this.right = x + r;
	this.top = y - r;
	this.bottom = y + r;
	this.height = r + r;
	this.width = r + r;
}

var globalizedRect = (function(){
	
	function proc( doc, frame, p ) {
		var ok;
		
		if ( doc === frame.ownerDocument ) {
			ok = true;
			
		} else {
			var frames = doc.querySelectorAll('frame, iframe');
			for ( var i = 0, l = frames.length; !ok && i < l; ++i ) {
				var contentDoc = frames.contentDocument;
				if ( contentDoc && proc(contentDoc, frame, p) ) {
					ok = true;
				}
			}
		}
		
		if ( ok ) {
			p.x += frame.offsetLeft - doc.body.scrollLeft;
			p.y += frame.offsetTop - doc.body.scrollTop;
		}
		
		return ok;
	}
	
	return function( rect, frame ) {
		var p = { x: 0, y: 0 };
		proc( document, frame, p );
		return new MovedRect( rect, p.x, p.y );
	};
	
})();

var reWordInclude = /^[\w\u00c0-\uFFFF\']+$/;
var reWordExclude = /[\d“”]/;
var reWordJoiner = /^[\s—\-_]+$/;

function wordBound( str, p, inc ) {
	var	oldp = p,
		c = str[p],
		pc = charCase(c), cc,
		nc = ( inc < 0 ? -1 : 1 ),
		next = ( inc < 0 ? inc : inc - 1 );
	
	for ( ; ; p += inc ) {
		c = str[ p + next ];
		if ( !c || reWordExclude.test(c) ) break;
		cc = charCase( c );
		if ( !cc && !reWordInclude.test(c) || pc === -cc && cc === nc ) break;
		pc = cc;
	}
	
	if ( p !== oldp ) {
		if ( inc > 0 && str[p-1] === "'" || str[p] === "'" ) {
			p -= inc;
		}
	}
	
	return p;
}

function passLeftWordJoiner( str, p ) {
	for ( ; p > 0; --p ) {
		if ( !reWordJoiner.test( str[p-1] ) ) {
			return p;
		}
	}
	return -1;
}

function passRightWordJoiner( str, p ) {
	for ( var n = str.length; p < n; ++p ) {
		if ( !reWordJoiner.test( str[p] ) ) {
			return p;
		}
	}
	return -1;
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

function trisCombinations( a, b, c ) {
	var rv = [];
	
	c && rv.push( b + ' ' + c );
	a && rv.push( a + ' ' + b );
	
	rv.push( b );
	
	return rv;
}

});
