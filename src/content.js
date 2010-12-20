
var _options = {},
	_tooltip,
	_stayTimeoutId = null,
	_rect = null,
	_boxOutliner = null,
	_stayOnlyWithShift,
	_selectOnlyWithShift,
	_stayDelays,
	_noTooltipArrow,
	_holdNext,
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
	_hold = false;
	abort();
	
	for ( var name in options ) {
		if ( _options[name] === options[name] ) {
			continue;
		}
		
		var oldValue = _options[ name ];
		var newValue = options[ name ];
		
		switch ( name ) {
			case "tooltip.onStay":
				if ( newValue && !_boxOutliner ) {
					_boxOutliner = new BoxOutliner( document, "1px dashed red" );
					
				} else if ( !newValue ) {
					_boxOutliner = null;
				}
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
			limit: _options["tooltip.limit"]
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
		_tooltip.show( _rect, _options["tooltip.preferedPosition"], _noTooltipArrow );
		
	} else if ( _hold ) {
		_hold = false;
		abort();
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
	
	_rect = null;
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
	if ( _hold || _rect
		&& _rect.left <= event.clientX && _rect.right >= event.clientX
		&& _rect.top <= event.clientY && _rect.bottom >= event.clientY
	) { return; }
	
	abort();
	
	if ( !_stayOnlyWithShift || event.shiftKey ) {
		recObject( _event, event );
		_stayTimeoutId = setTimeout( onMouseStay, _stayDelays[event.shiftKey*1] );
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
			_rect = rect;
			_event.shiftKey && _boxOutliner.show( boxRect );
			//console.log( term );
			lookup( term );
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
		recObject( _event, event );
		setTimeout( onSelected, 1 );
	}
}
};

function onSelected() {
	var selection = window.getSelection();
	var selected = selection.toString();
	if ( selected && selected.length < 50 ) {
		if ( !checkSelection(selection) ) {
			_rect = new PointRect( _event.clientX, _event.clientY, 10 );
		} else {
			var range = selection.getRangeAt(0);
			_rect = range.getBoundingClientRect();
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
		if ( event.shiftKey ) {
			_noTooltipArrow = true;
			lookup( event.target.textContent );
		
		} else {
			setSelection( event.target.textContent );
			_hold = false;
			abort();
		}
	}
}
};

function setSelection( text ) {
	var selection = document.getSelection(),
		selected = selection.toString(),
		node, a, b, spaceLeft, spaceRight, value;
	
	if ( !selected ) {
		return;
	}
	
	spaceLeft = selected.match(/^(\s*)/)[1];
	spaceRight = selected.match(/(\s*)$/)[1];
	selected = selected.slice( spaceLeft.length, -spaceRight.length );
	text = spaceLeft + toSameCaseAs( text, selected ) + spaceRight;
	
	if ( checkSelection(selection) ) {
		node = selection.anchorNode;
		value = node.textContent;
		a = selection.anchorOffset;
		b = ( node === selection.focusNode ) ? selection.focusOffset : value.length;
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
	if ( sample.toUpperCase() === sample ) {
		return str.toUpperCase();
	}
	if ( sample[0].toUpperCase() === sample[0] ) {
		return str[0].toUpperCase() + str.substr(1);
	}
	return str;
}

function checkSelection( selection ) {
	return selection.focusNode.parentNode === _event.target;
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
var reWordJoiner = /^[\s—\-_]+$/;

function wordBound( str, p, inc ) {
	var c = str[p],
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

function getRightWord( str, b ) {
	var a = passRightWordJoiner( str, b );
	if ( a !== -1 && isWord(str[a]) ) {
		b = wordBound( str, a, 1 );
		return str.substring( a, b );
	}
	return '';
}

function getLeftWord( str, a ) {
	var b = passLeftWordJoiner( str, a );
	if ( b !== -1 && isWord(str[b-1]) ) {
		a = wordBound( str, b, -1 );
		return str.substring(a, b);
	}
	return '';
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
