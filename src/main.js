var bg = module("main", function( bg, require ) {
	
var utils = require("utils"),
	io = require("io"),
	options = require("options"),
	dictionary_async = require("dictionary/async"),
	morfology = require("morfology"),
	reLocalize = /__MSG_(.+?)__/g;

bg.options = options;
bg.require = require;

function replLocalize( str, name ) {
	return chrome.i18n.getMessage( name ) || str;
}


bg.localizeDom = function( top ) {
	var elements = top.getElementsByTagName("*"),
		element, childs, node, text0, text1;
	
	for ( var i = 0; element = elements[i]; ++i ) {
		childs = element.childNodes;
		
		for ( var j = 0; node = childs[j]; ++j ) {
			if ( node.nodeType === 3 ) {
				text0 = node.nodeValue;
				text1 = text0.replace( reLocalize, replLocalize );
				
				if ( text0 !== text1 ) {
					node.nodeValue = text1;
				}
			}
		}
	}
}

bg.getDictNames = function() {
	return _builtinDicts.map(function( info ) {
		return info.name;
	});
};

function localizedDictName( name ) {
	return chrome.i18n.getMessage( name.replace(/-/g, '_') ) || name;
}
bg.localizedDictionaryName = localizedDictName;

var _dicts = [],
	_dictInfo,
	_options = {},
	
	_builtinDicts = [
		{
			name: 'en-hr',
			revision: 4,
			morf: 'en',
			path: './EH/EH-utf8.Txt',
			sep: '\t',
			term_column: 1,
			def_column: 2
		},
		{
			name: 'hr-en',
			revision: 4,
			morf: 'hr',
			path: './EH/EH-utf8.Txt',
			sep: '\t',
			term_column: 2,
			def_column: 1
		}
	],

	manifest = JSON.parse( io.readFile('./manifest.json') );
	

options.onSaved.addListiner(function( newOptions ) {
	if ( newOptions["tooltip.enabled"] !== _options["tooltip.enabled"] ) {
		setButton( newOptions["tooltip.enabled"] );
	}
	
	_options = newOptions;
	sendToAllTabs({ type: "options", options: newOptions });
});

options.init({
	"tooltip.enabled": true,
	"tooltip.onStay": 2,
	"tooltip.onStay.delays": [200, 500],
	"tooltip.preferedPosition": "above",
	"tooltip.limit": 4,
	"tooltip.onSelect": 2,
	"popup.limit": 0,
	"implicit_dicts": ["en-hr"]
});


function init() {
	var toBuild = [], info, dict, name,
		a, b;
	
	a = mapArrayWithProp( _builtinDicts, 'name' );
	b = mapArrayWithProp( utils.loadObject('dicts') || [], 'name' );
	
	for ( name in a ) {
		if ( !(name in b) || a[name].revision > (b[name].revision || 0)  ) {
			b[ name ] = a[ name ];
		}
	}
	
	for ( name in b ) {
		info = b[name];
		
		morf = info.morf ?
			morfology.Transformations.fromFile( './morf/' + info.morf + '.affx' ) :
			null;
			
		dict = new dictionary_async.Dictionary( info.name, morf );
		
		_dicts.push( dict );
		
		if ( !info.ready ) {
			toBuild.push( dict );
		}
	}
	
	_dictInfo = utils.values( b );
	
	utils.saveObject('dicts', _dictInfo);

	if ( toBuild.length ) {
		window.setTimeout(function() {
			var start = Date.now();
			reloadDicts( toBuild, function() {
				utils.saveObject('dicts', _dictInfo);
				console.log( (Date.now() - start) / 1000 );
			});
		}, 1);
	}
	
	
	console.log( manifest.name + ' ' + manifest.version );
	
	bg.version = manifest.version;
	
	var prev_version = localStorage.version;
	localStorage.version = manifest.version;
	
	//if ( !prev_version || prev_version < manifest.version ) {
	//	openOptionsPage();
	//}
}

	
function _findByName_( name ) {
	for ( var i = 0, l = this.length; i < l; ++i ) {
		if ( this[i].name === name ) {
			return this[i];
		}
	}
	return null;
}

function mapArrayWithProp( arr, prop ) {
	var map = utils.HASH();
	for ( var i = 0, l = arr.length; i < l; ++i ) {
		map[ arr[i][prop] ] = arr[i];
	}
	return map;
}

function openOptionsPage() {
	var url = chrome.extension.getURL( manifest.options_page );
	chrome.tabs.create( { url: url } );
}
	

function reportError( error ) {
	console.error( error );
}

function getAllTabs( callback ) {
	chrome.windows.getAll({populate: true}, function( windows ) {
		var tabs = [];
		
		for ( var i = 0, l = windows.length; i < l; ++i ) {
			tabs.push.apply( tabs, windows[i].tabs );
		}
		
		callback( tabs );
	});
}

function sendToAllTabs( request ) {
	getAllTabs(function( tabs ) {
		for ( var i = 0, l = tabs.length; i < l; ++i ) {
			chrome.tabs.sendRequest( tabs[i].id, request );
		}
	});
}

function setButton( enabled ) {
	chrome.browserAction.setIcon({
		path: ( enabled ? "images/icon19.png" : "images/icon19-off.png" )
	});
	var msgName = enabled ? "disableTooltip_title" : "enableTooltip_title";
	chrome.browserAction.setTitle({
		title: chrome.i18n.getMessage( msgName, [ manifest.name ] )
	});
}


chrome.browserAction.onClicked.addListener(function() {
	var o = options.load();
	o["tooltip.enabled"] = !o["tooltip.enabled"];
	options.save( o );
});


chrome.extension.onRequest.addListener(function( req, sender, send ) {
	switch ( req.type ) {
		case "getOptions":
			send( _options );
			break;
		
		case "lookup":
			lookup( req, send );
			break;
		
		default:
			send();
	}
});


function reloadDicts( dicts, callback ) {
	var dict, info;
	
	dicts = dicts.concat();
	
	function next( error ) {
		if ( error ) {
			console.error( error );
			utils.removeFromArray( _dicts, dict );
			utils.removeFromArray( _dictInfo, info );
			dict.free();
			
		} else if ( info ) {
			info.ready = true;
		}
	
		dict = dicts.shift();
		if ( !dict ) {
			callback && callback();
			return;
		}
		
		console.log('Reloadin dictionary "' + dict.name + '"...')
		
		info = _findByName_.call( _dictInfo, dict.name );
		
		try {
			var data = io.readFile( info.path );
			var obj = parse(
				data,
				info.sep,
				info.term_column - 1,
				info.def_column - 1
			);
			
		} catch ( error ) {
			next( error );
			return;
		}
		
		dict.empty(next, function() {
			dict.setFromObject( obj, next, next );
		});
	}
	
	next();
}


function parse( data, sep, keyIndex, valueIndex ) {
	var lines = utils.splitLines( data ),
		map = utils.HASH(), parts, key, value;
	
	for ( var i = 0, l = lines.length; i < l; ++i ) {
		parts = lines[i].split( sep );
		
		key = ( parts[ keyIndex ] || "" ).trim();
		value = ( parts[ valueIndex ] || "" ).trim();
		
		if ( key && value ) {
			if ( key in map ) {
				map[ key ].push( value );
				
			} else {
				map[ key ] = [ value ];
			}
		}
	}
	
	return map;
}

//bg.calc = function( index ) {
//	console.log("loading lines...");
//	var lines = utils.splitLines( io.readFile( _dictInfo[0].path ) );
//	
//	console.log("buiilding map...");
//	var map = utils.HASH();
//	for ( var i = 0, l = lines.length; i < l; ++i ) {
//		var term = lines[i].split('\t')[ index ];
//		if ( !term ) {
//			continue;
//		}
//		
//		var key = term
//			.trim()
//			.replace(/\s*[\(\[].*/, '')
//			.replace(/(?:[^\w\u00c0-\uFFFF\']|[\d“”_])+/g, '')
//			.toLowerCase();
//			
//		var d = map[ key ];
//		
//		if ( !d ) {
//			d = {};
//			map[ key ] = d;
//		}
//		
//		d[ term ] = true;
//	}
//	console.log("("+l+" terms)");
//	
//	console.log("building numeric map...");
//	var num_map = utils.HASH();
//	var sum = utils.HASH();
//	for ( var key in map ) {
//		var n = Object.keys( map[key] ).length;
//		num_map[ key ] = n;
//		
//		if ( n in sum ) {
//			++sum[n];
//		} else {
//			sum[n] = 1;
//		}
//	}
//	
//	console.log("retriving keys...");
//	var keys = Object.keys( num_map );
//	console.log("("+keys.length+" keys)");
//	
//	console.log("sorting keys by number of terms...");
//	keys.sort(function(a, b){
//		return num_map[b] - num_map[a];
//	});
//	
//	return {
//		map: map,
//		num_map: num_map,
//		keys: keys,
//		sum: sum
//	};
//};


function lookup( o, callback ) {
	var	dicts = o.dicts || _dicts,
		terms = typeof o.term === "string" ? [o.term] : o.term,
		results = [];
	
	dicts = ( typeof dicts[0] === "string" ) ?
		dicts.map( _findByName_, _dicts ) :
		dicts.concat();
	
	function error( error ) {
		reportError( error );
		collect();
	}
	
	function collect( res ) {
		if ( res ) {
			res = exactsFirst( res );
			
			if ( o.limit && res.length > o.limit ) {
				res.length = o.limit;
			}
			
			if ( res.length ) {
				results.push.apply( results, res );
			}
		}
		
		if ( dicts.length ) {
			var dict = dicts.shift(),
				info = _findByName_.call( _dictInfo, dict.name );
			
			if ( info.ready ) {
				dict.lookup( terms, o.stopOnExact, error, collect );
			} else {
				collect([{
					message: chrome.i18n.getMessage("dict_not_ready_try_later"),
					dict: dict.name
				}]);
			}
			
		} else {
			if ( o.localize ) {
				results.forEach(function( res ) {
					res.dict_localized = localizedDictName( res.dict );
				});
			}
			callback( results );
		}
	}
	
	collect();
}



function exactsFirst( res ) {
	var exacts = [], others = [], r;
	
	for ( var i = 0, l = res.length; i < l; ++i ) {
		r = res[i];
		
		( r.exact !== false ? exacts : others ).push( r );
	}
	
	return exacts.concat( others );
}


init();
//setTimeout( init, 5000 );


});
