;(function(){
	
var exports = this.exports || this;
	
function def( name, prototype ) {
	var ctor = function( doc ) {
		this._doc = doc;
		this.init.apply( this, arguments );
	};
	
	ctor.prototype = prototype;
	prototype.constructor = ctor;
	prototype.__proto__ = shape;
	
	exports[ name ] = ctor;
	return ctor;
}

var shape = {
	init: function( doc ) {
		
	},
	reset: function() {
		this.hide();
		this.init.apply( this, arguments );
	},
	show: function( rect ) {
		this.visible && this._hide();
		this._show( rect );
		this.visible = true;
	},
	hide: function() {
		if ( this.visible ) {
			this._hide();
			this.visible = false;
		}
	}
};
	
function detach( node ) {
	node.parentNode && node.parentNode.removeChild( node );
}

def("Tooltip", {
	init: function() {
		var s;
		
		this._box_ = this._create('div');
		this._box_.style.position = "absolute";
		this._box_.style.background = "transparent";
		
		this.$box = this._box_.cloneNode(false);
		this.$box.style.opacity = ".95";
		this.$box.style.zIndex = "99991";
		
		this.$content = this._create('div');
		s = this.$content.style;
		s.background = "#ffffbf";
		s.border = "2px solid #e1c642";
		s.color = "#000";
		s.padding = "7px";
		s.maxWidth = "250px";
		s.zIndex = "99992";
		s.setProperty && s.setProperty("-webkit-border-radius", "5px", null);
		s.setAttribute && s.setAttribute("border-radius", "5px");
		this.$box.appendChild( this.$content );
		
		this._b_ = this._create('b');
		this._b_.style.fontWeight = "bold";
		
		this._sep_ = this._create('div');
		this._sep_.style.height = "0.5em";
		
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
	
	_create: function( name ) {
		var elem = this._doc.createElement( name );
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
		s.display = name === "div" ? "block" : "inline";
		return elem;
	},
	
	setContent: function( list ) {
		this.$content.innerHTML = '';
		
		for ( var i = 0, l = list.length; i < l; ++i ) {
			if ( i !== 0 ) {
				this.$content.appendChild( this._sep_.cloneNode(false) );
			}
			
			var b = this._b_.cloneNode(false);
			var t = list[i].term;
			if ( (list[i].parts || '').length > 1 ) {
				t = '(' + t + ')';
			}
			b.textContent = t;
			this.$content.appendChild( b );
			
			t = ': ' + list[i].definitions.join(', ');
			this.$content.appendChild(  this._doc.createTextNode( t ) );
		}
	},
	
	_show: function( rect ) {
		var box = this.$box;
		var body = this._doc.body;
		
		box.style.visibility = "hidden";
		box.style.top = '0';
		box.style.left = '0';
		
		body.appendChild( box );
		
		var boxW = box.offsetWidth;
		var boxH = box.offsetHeight;
		
		var bodyW = body.offsetWidth;
		var bodyH = body.offsetHeight;
		
        var scrollLeft = this._doc.documentElement.scrollLeft + body.scrollLeft;
        var scrollTop = this._doc.documentElement.scrollTop + body.scrollTop;
		
		var x = Math.round( (rect.left + rect.right) / 2 );
		
		var arrow;
		var boxY = rect.top - 10 - boxH;
		var boxX = x - Math.round( boxW / 2 );
		
		var dx = boxX + boxW - bodyW;
		if ( dx > 0 ) boxX -= dx;
		if ( boxX < 0 ) boxX = 0;
		
		if ( boxY >= 0 ) {
			arrow = this.$down;
			arrow.style.top = rect.top - 12 + scrollTop + "px";
		} else {
			boxY = rect.bottom + 10;
			if ( boxY + boxH > bodyH ) {
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
			arrow.style.left = x - 12 + scrollLeft + 'px';
			body.appendChild( arrow );
		}
	},
	
	_hide: function() {
		detach( this.$box );
		detach( this.$up );
		detach( this.$down );
	}
});

def("BoxOutliner", {
	init: function( doc, border ) {
		var t = doc.createElement('div');
		var s = t.style;
		s.margin = "0";
		s.padding = "0";
		s.position = "absolute";
		s.background = "transparent";
		s.display = "block";
		s.visibility = "visible";
		s.zIndex = "99990";
		s.border = "0";
		s.height = "0";
		s.width = "0";
		
		this.$top = t.cloneNode(false);
		this.$top.style.borderTop = border;
		
		this.$bottom = t.cloneNode(false);
		this.$bottom.style.borderBottom = border;
		
		this.$left = t.cloneNode(false);
		this.$left.style.borderLeft = border;
		
		this.$right = t.cloneNode(false);
		this.$right.style.borderRight = border;
	},
	
	_show: function( rect ) {
		var b = rect2box( this._doc, rect );
		
		this.$top.style.top = b.top + 'px';
		this.$top.style.left = b.left + 'px';
		this.$top.style.width = b.width + 'px';
		
		this.$right.style.top = b.top + 'px';
		this.$right.style.left = b.left + b.width + 'px';
		this.$right.style.height = b.height + 'px';
		
		this.$bottom.style.top = b.top + b.height + 'px';
		this.$bottom.style.left = b.left + 'px';
		this.$bottom.style.width = b.width + 'px';
		
		this.$left.style.top = b.top + 'px';
		this.$left.style.left = b.left + 'px';
		this.$left.style.height = b.height + 'px';
		
		b = this._doc.body;
		b.appendChild( this.$top );
		b.appendChild( this.$right );
		b.appendChild( this.$bottom );
		b.appendChild( this.$left );
	},
	
	_hide: function() {
		detach( this.$top );
		detach( this.$right );
		detach( this.$bottom );
		detach( this.$left );
	}
});

function rect2box( doc, rect ) {
	return {
		left: rect.left + doc.documentElement.scrollLeft + doc.body.scrollLeft,
		top: rect.top + doc.documentElement.scrollTop + doc.body.scrollTop,
		width: rect.right - rect.left,
		height: rect.bottom - rect.top
	};
}

})();
