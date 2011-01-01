//localStorage.clear();

module("main", function( exports, require ) {
	

var utils = require("utils"),
	io = require("io"),
	options = require("options"),
	storage_async = require("storage/async"),
	dictionary_async = require("dictionary/async"),
	morfology = require("morfology"),
	Emitter = require("events").Emitter;


var manifest = JSON.parse( io.readFile('./manifest.json') );


var _options = options.init({
	"tooltip.enabled": true,
	"tooltip.onStay": 1,
	"tooltip.onStay.delay": 400,
	"tooltip.onStay.withShift.delay": 200,
	"tooltip.preferedPosition": "above",
	"tooltip.limit": 4,
	"tooltip.onSelect": 2,
	"popup.limit": 0
});

var dictInfo = {
	'en-hr': {
		revision: 2,
		morf: 'en',
		inv: 'hr-en',
		path: './EH/EH-utf8.Txt',
		sep: '\t',
		term_column: 1,
		def_column: 2
	},
	'hr-en': {
		revision: 2,
		morf: 'hr',
		inv: 'en-hr',
		path: './EH/EH-utf8.Txt',
		sep: '\t',
		term_column: 2,
		def_column: 1
	}
};

var _dicts = [],
	
	initialized = false,
	onInitialized = new Emitter();
	

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

function init() {
	var toReload = [], info, oldInfo, dict;
	var oldDictInfo = utils.loadObject('dictInfo') || {};
	
	for ( var name in dictInfo ) {
		info = dictInfo[ name ];
		oldInfo = oldDictInfo[ name ] || {};
		
		morf = info.morf ?
			morfology.Transformations.fromFile( './morf/' + info.morf + '.aff' ) :
			null;
			
		dict = new dictionary_async.Dictionary( name, morf );
		
		_dicts.push( dict );
		
		if ( info.revision > ( oldInfo.revision || 0 ) ) {
			toReload.push( dict );
		}
		
		delete oldDictInfo[ name ];
	}
	
	for ( var name in oldDictInfo ) {
		storage_async.DictStorage.erase( name );
	}

	if ( toReload ) {
		// SET POPUP
		reloadDicts(toReload, function() {
			// RESET POPUP
			onInitialized.emit();
		});
		
	} else {
		onInitialized.emit();
	}
}


onInitialized.addListiner(function() {
	initialized = true;
	utils.saveObject( 'dictInfo', dictInfo );
	console.log( manifest.name + ' ' + manifest.version );
});


options.onSaved.addListiner(function( newOptions ) {
	_options = newOptions;
	sendToAllTabs({ type: "options", options: newOptions });
});

chrome.extension.onRequest.addListener(function( req, sender, send ) {
	switch ( req.type ) {
		case "getOptions":
			send( _options );
			break;
		
		case "lookup":
			lookup( req.term, req.limit, req.stopOnExact, send );
			break;
		
		default:
			send();
	}
});


function reloadDicts( dicts, callback ) {
	dicts = dicts.concat();
	var dict;
	
	function next( error ) {
		if ( error ) {
			console.error( error );
			utils.remove( _dicts, dict );
			delete dictInfo[ dict.name ];
			dict.free();			
		}
	
		dict = dicts.shift();
		if ( !dict ) {
			callback();
			return;
		}
		
		console.log('Reloadin dictionary "' + dict.name + '".')
		
		try {
			var info = dictInfo[ dict.name ];
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


//function parse( data ) {
//	var lines = utils.splitLines( data ),
//		rv = utils.HASH(), pos, term, defs, _push = [].push;
//		
//	for ( var i = 0, l = lines.length; i < l; ++i ) {
//		pos = lines[i].indexOf('=');
//		
//		if ( pos !== -1 ) {
//			term = lines[i].substr( 0, pos ).trim().toLowerCase();
//			defs = lines[i].substr( pos + 1 ).trim().split(/\s*\|\s*/);
//			
//			if ( term in rv ) {
//				_push.apply( rv[ term ], defs );
//				
//			} else {
//				rv[ term ] = defs;
//			}
//		}
//	}
//	
//	return rv;
//}

function parse( data, sep, keyIndex, valueIndex ) {
	var lines = utils.splitLines( data ),
		map = utils.HASH(), parts, key, value;
	
	for ( var i = 0, l = lines.length; i < l; ++i ) {
		parts = lines[i].split( sep );
		
		key = ( parts[ keyIndex ] || "" ).trim().toLowerCase();
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


function lookup( term, limit, stopOnExact, callback ) {
	var terms = normalizedTerms( typeof term === "string" ? [term] : term ),
		dicts = _dicts.concat(),
		results = [];
	
	function error( error ) {
		reportError( error );
		collect();
	}
	
	function collect( res ) {
		if ( res ) {
			res = exactsFirst( res );
			
			if ( limit && res.length > limit ) {
				res.length = limit;
			}
			
			if ( res.length ) {
				results.push.apply( results, res );
			}
		}
		
		if ( dicts.length ) {
			dicts.shift().lookup( terms, stopOnExact, error, collect );
			
		} else {
			callback( results );
		}
	}
	
	collect();
}


function K( obj ) {
	return !!obj;
}

function exactsFirst( res ) {
	var exacts = [], others = [], r;
	
	for ( var i = 0, l = res.length; i < l; ++i ) {
		r = res[i];
		
		if ( r.originalTerm && r.originalTerm !== r.term ) {
			others.push( r );
			
		} else {
			exacts.push( r );
		}
	}
	
	return exacts.concat( others );
}

function normalizedTerms( terms ) {
	var t, rv = [];
	
	for ( var i = 0, l = terms.length; i < l; ++i ) {
		t = terms[i].replace(/[\s—\-_]+/g, ' ').trim().toLowerCase();
		
		if ( t.indexOf(' ') !== -1 ) {
			rv.push( t.replace(/ /g, '-'), t, t.replace(/ /g, '') );
			
		} else {
			rv.push( t );
		}
	}
	
	return rv;
}


init();
//setTimeout( init, 5000 );


});
