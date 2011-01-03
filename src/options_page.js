
var bg = chrome.extension.getBackgroundPage().bg;

var _options;

function init() {
	reset();
	
	$("save_button").addEventListener("click", save, false);
	$("reset_button").addEventListener("click", reset, false);
	
	window.addEventListener("change", function( event ) {
		var name = event.target.nodeName.toLowerCase();
		if ( name === "input" || name === "select" ) {
			enabledButtonns( true );
			
			if ( event.target.name == "onStay_mode" ) {
				dictRowShow( event.target.value === "2" );
			}
		}
	}, false);
}

function reset() {
	_options = bg.options.load();
	setRadioGroup("onStay_mode", _options["tooltip.onStay"]);
	setRadioGroup("onSelect_mode", _options["tooltip.onSelect"]);
	setRadioGroup("position", _options["tooltip.preferedPosition"]);
	
	var selDict = $("implicit_dictionary"),
		opt = document.createElement('option'),
		dict_names = bg.dictNames;
	
	selDict.innerHTML = "";
	
	dict_names.forEach(function( name ) {
		var o = opt.cloneNode(false);
		o.value = name;
		o.textContent = name;
		selDict.appendChild( o );
	});
	
	selDict.selectedIndex = dict_names.indexOf( _options["implicit_dicts"][0] );
	dictRowShow( _options["tooltip.onStay"] === 2 );
	
	enabledButtonns( false );
}

function dictRowShow( show ) {
	$("star0").style.display = show ? "inline" : "none";
	
	var style = $("implicit_dictionary_row").style;
	
	if ( show ) {
		style.display = "block";
		style.opacity = 1;
	} else {
		style.display = "none";
		style.opacity = 0;
	}
}

function save() {
	_options["tooltip.onStay"] = getValueFromRadioGroup("onStay_mode") * 1;
	_options["tooltip.onSelect"] = getValueFromRadioGroup("onSelect_mode") * 1;
	_options["tooltip.preferedPosition"] = getValueFromRadioGroup("position");
	_options["implicit_dicts"] = [ $("implicit_dictionary").value ];
	
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

