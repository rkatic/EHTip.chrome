module("shapes", function( exports, require ) {
	
var Shape = Class({
	constructor: function( document ) {
		this._doc = document;
		this._init.apply( this, arguments );
	},
	
	show: function() {
		this._show.apply( this, arguments );
		this.visible = true;
	},
	
	hide: function() {
		if ( this.visible ) {
			this._hide();
			this.visible = false;
		}
	},
	
	createElement: function( name ) {
		var _name_ = '_' + name + '_';
		
		if ( !this[_name_] ) {
			this[_name_] = this._doc.createElement( name );
			this.resetNode( this[_name_] );
		}
		
		return this[_name_].cloneNode(false);
	},
	
	setContent: function( arg ) {
		var c = this._content;
		c.innerHTML = '';
		
		if ( !arg ) {
			return;
		}
		
		if ( arg.nodeType ) {
			c.appendChild( arg );
			
		} else {
			var t = this.visible ? this._doc.createDocumentFragment() : c;
			
			for ( var i = 0, l = arg.length; i < l; ++i ) {
				t.appendChild( arg[i] );
			}
			
			if ( t !== c ) {
				c.appendChild = t;
			}
		}
	},
	
	resetNode: noop,
	_show: noop,
	_hide: noop,
	_init: noop
});


function noop(){}
	
function detach( node ) {
	node.parentNode && node.parentNode.removeChild( node );
}


exports.Tooltip = Class( Shape, {
	_init: function() {
		var s;
		
		this._box_ = this.createElement('div');
		this._box_.style.position = "absolute";
		this._box_.style.background = "transparent";
		
		this.$box = this._box_.cloneNode(false);
		this.$box.style.opacity = ".95";
		this.$box.style.zIndex = "99991";
		
		this._content = this.createElement('div');
		s = this._content.style;
		s.background = "#ffffbf";
		s.border = "2px solid #e1c642";
		s.color = "#000";
		s.padding = "7px";
		s.maxWidth = "250px";
		s.zIndex = "99992";
		s.setProperty && s.setProperty("-webkit-border-radius", "5px", null);
		s.setAttribute && s.setAttribute("border-radius", "5px");
		this.$box.appendChild( this._content );
		
		this._b_ = this.createElement('b');
		this._b_.style.fontWeight = "bold";
		
		this._sep_ = this.createElement('div');
		this._sep_.style.height = "0.5em";
		this._sep_.background = "transparent";
		
		this.$up = this._createArrow("up");
		this.$down = this._createArrow("down");
	},
	
	_createArrow: function( dir ) {
		var s;
		
		var inner = this._box_.cloneNode(false);
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
		
		var outher = this._box_.cloneNode(false);
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
		
		var arrow = this.$box.cloneNode(false);
		arrow.style.zIndex = "99996";
		arrow.appendChild( inner );
		arrow.appendChild( outher );
		
		return arrow;
	},
	
	resetNode: function( elem ) {
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
		s.visibility = "visible";
		s.display = elem.tagName.toLowerCase() === "div" ? "block" : "inline";
	},
	
	_show: function( rect, position, noArrow ) {
		var pos = /^(?:up|above)$/i.test( position ) ? 1 : -1;
		
		this.visible && this._hide();
		
		var box = this.$box;
		var doc = this._doc;
		var body = doc.body;
		
		var bodyRect = body.getBoundingClientRect();
		var dx = -bodyRect.left;
		var dy = -bodyRect.top;
		
		//var scrollLeft = body.scrollLeft;
		//var scrollTop = body.scrollTop;
		//var scrollLeft = doc.documentElement.scrollLeft + body.scrollLeft;
		//var scrollTop = doc.documentElement.scrollTop + body.scrollTop;
		
		
		box.style.visibility = "hidden";
		box.style.top = "0";
		box.style.left = "0";
		
		body.appendChild( box );
		
		var b = {
			width: box.offsetWidth,
			height: box.offsetHeight
		};
		
		
		var x = Math.round( (rect.left + rect.right) / 2 );
		
		b.left = x - Math.round( b.width / 2 );
		b.right = b.left + b.width;
		
		var d = b.right - doc.documentElement.offsetWidth;
		if ( d > 0 ) {
			b.left -= d;
			b.right -= d;
		}
		if ( b.left < 0 ) {
			b.left = 0;
			b.right = b.width;
		}
		
		
		var arrow, badNodes;
		
		function setRect( pos, last ) {
			if ( pos === 1 ) {
				b.top = rect.top - 10 - b.height;
				b.bottom = b.top + b.height;
				if ( b.top < 0 ) {
					b.top = 0;
					return 0;
				};
			
			} else {
				b.top = rect.bottom + 10;
				b.bottom = b.top + b.height;
				if ( b.bottom > ( doc.defaultView.innerHeight - 20 ) ) {
					b.top = b.height;
					return 0;
				}
			}
			
			if ( !last ) {
				badNodes = badNodes || doc.querySelectorAll('embed, object, iframe');
				if ( rectOverAnyOfNode( b, badNodes ) ) return 0;
			}
			
			return pos;
		}
		
		pos = setRect( pos ) || setRect( -pos ) || setRect( pos, true );
		
		if ( pos && !noArrow ) {
			if ( pos === 1 ) {
				arrow = this.$down;
				arrow.style.top = rect.top - 12 + dy + "px";
			} else {
				arrow = this.$up;
				arrow.style.top = rect.bottom + dy + "px";
			}
			arrow.style.left = x - 12 + dx + 'px';
			body.appendChild( arrow );
		}
		
		
		box.style.top = b.top + dy + 'px';
		box.style.left = b.left + dx + 'px';
		box.style.visibility = "visible";
	},
	
	_hide: function() {
		detach( this.$box );
		detach( this.$up );
		detach( this.$down );
	}
});

exports.BoxOutliner = Class( Shape, {
	_init: function( doc, border ) {
		var t = this.createElement('div');
		var s = t.style;
		s.top = "0";
		s.left = "0";
		s.margin = "0";
		s.padding = "0";
		s.position = "absolute";
		s.background = "transparent";
		s.display = "block";
		s.visibility = "visible";
		s.border = "0";
		s.height = "0";
		s.width = "0";
		
		this.$w = t.cloneNode(false);
		this.$w.style.zIndex = "99990";
		this.$w.style.overflow = "visible";
		
		this.$top = t.cloneNode(false);
		this.$top.style.borderTop = border;
		
		this.$bottom = t.cloneNode(false);
		this.$bottom.style.borderBottom = border;
		
		this.$left = t.cloneNode(false);
		this.$left.style.borderLeft = border;
		
		this.$right = t.cloneNode(false);
		this.$right.style.borderRight = border;
		
		this.$w.appendChild( this.$top );
		this.$w.appendChild( this.$bottom );
		this.$w.appendChild( this.$left );
		this.$w.appendChild( this.$right );
	},
	
	_show: function( r ) {
		var body = this._doc.body
		var bodyRect = body.getBoundingClientRect();
		var dx = -bodyRect.left;
		var dy = -bodyRect.top;
		
		var s = this.$top.style;
		s.top = r.top + dy + 'px';
		s.left = r.left + dx + 'px';
		s.width = r.width + 'px';
		
		s = this.$right.style;
		s.top = r.top + dy + 'px';
		s.left = r.right + dx + 'px';
		s.height = r.height + 'px';
		
		s = this.$bottom.style;
		s.top = r.bottom + dy + 'px';
		s.left = r.left + dx + 'px';
		s.width = r.width + 'px';
		
		s = this.$left.style;
		s.top = r.top + dy + 'px';
		s.left = r.left + dx + 'px';
		s.height = r.height + 'px';
		
		if ( this.$w.parentNode !== body ) {
			body.appendChild( this.$w );
		}
	},
	
	_hide: function() {
		detach( this.$w );
	}
});


function rectOverAnyOfNode( a, nodes ) {
	for ( var i = 0, l = nodes.length; i < l; ++i ) {
		var b = nodes[i].getBoundingClientRect();
		if (!( a.left < b.left && a.right < b.left
			|| a.left > b.right && a.right > b.right
			|| a.top < b.top && a.bottom < b.top
			|| a.top > b.bottom && a.bottom > b.bottom
		)) return true;
	}
	return false;
}

});
