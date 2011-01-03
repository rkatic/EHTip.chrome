
var bg = chrome.extension.getBackgroundPage().bg;

var _options;

function init() {
	reset();
	
	$("save_button").addEventListener("click", save, false);
	$("reset_button").addEventListener("click", reset, false);
	
	window.addEventListener("change", function( event ) {
		if ( event.target.nodeName.toLowerCase() === "input" ) {
			enabledButtonns( true );
		}
	}, false);
}

function reset() {
	_options = bg.options.load();
	setRadioGroup("onStay_mode", _options["tooltip.onStay"]);
	setRadioGroup("onSelect_mode", _options["tooltip.onSelect"]);
	enabledButtonns( false );
}

function save() {
	_options["tooltip.onStay"] = getValueFromRadioGroup("onStay_mode") * 1;
	_options["tooltip.onSelect"] = getValueFromRadioGroup("onSelect_mode") * 1;
	
	enabledButtonns( false );
	bg.options.save( _options );
	
	var status = $("save_status");
	status.style.setProperty("-webkit-transition", "opacity 0s ease-in");
	status.style.opacity = 1;
	window.setTimeout(function() {
		status.style.setProperty("-webkit-transition", "opacity 0.5s ease-in");
		status.style.opacity = 0
	}, 500);
}

function enabledButtonns( enabled ) {
	$("save_button").disabled = !enabled;
	$("reset_button").disabled = !enabled;
}

function $( id ) {
	return document.getElementById( id );
}

function getValueFromRadioGroup( name ) {
	var nodes = document.options_form[ name ];
	
	for ( var i = 0, node; node = nodes[i]; ++i ) {
		if ( node.checked ) {
			return node.value;
		}
	}
	return '';
}

function setRadioGroup( name, value ) {
	var nodes = document.options_form[ name ];
	
	for ( var i = 0, node; node = nodes[i]; ++i ) {
		node.checked = ( node.value == value );
	}
}

