//localStorage.clear();

var manifest = JSON.parse( io.readFile('./manifest.json') );
console.log( manifest.name + ' ' + manifest.version );

var _options = options.init({
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
		revision: 1,
		morf: 'en',
		inv: 'hr-en'
	},
	'hr-en': {
		revision: 1,
		morf: 'hr',
		inv: 'en-hr'
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
	var toReload = [];
	var oldDictInfo = utils.loadObject('dictInfo') || {};
	
	for ( var name in dictInfo ) {
		var info = dictInfo[ name ];
		var oldInfo = oldDictInfo[ name ] || {};
		var dict = info.morf ?
			new dictionary.async.Dictionary( name, './dicts/' + info.morf + '.aff' ) :
			new dictionary.async.SimpleDictionary( name );
		
		_dicts.push( dict );
		
		if ( info.revision > ( oldInfo.revision || 0 ) ) {
			toReload.push( dict );
		}
		
		delete oldDictInfo[ name ];
	}
	
	for ( var name in oldDictInfo ) {
		dictionary.async.DictStorage.erase( name );
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
	console.log('INITIALIZED');
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
			lookup( req.term, req.limit, send );
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
		
		dict.removeAllDefinitions(next, function() {
			var data = io.readFile('./dicts/' + dict.name + '.dict');
			dict.setDefinitionsFromData( data, next, next );
		});
	}
	
	next();
}


function lookup( term, limit, callback ) {
	var terms = normalizedTerms( typeof term === "string" ? [term] : term ),
		dicts = _dicts.concat(),
		//n = dicts.length + 1, toClean,
		//start = Date.now(),
		results = [];
	
	function error( error ) {
		reportError( error );
		collect();
	}
	
	function collect( res ) {
		if ( res ) {
			if ( limit && res.length > limit ) {
				res.length = limit;
			}
			if ( res.length ) {
				results.push.apply( results, res );
			}
		}
		if ( dicts.length ) {
			dicts.shift().lookup( terms, error, collect );
			
		} else {
			//console.log( Date.now() - start );
			callback( results );
		}
	}
	
	collect();
	
	//function done( error ) {
	//	if ( error ) {
	//		reportError( error );
	//		toClean = true;
	//	}
	//	if ( --n === 0 ) {
	//		if ( toClean ) {
	//			results = results.filter( K );
	//		}
	//		var a = [];
	//		callback( a.concat.apply(a, results) );
	//	}
	//}
	//
	//dicts.forEach(function( dict, i ) {
	//	dict.lookup(terms, done, function( res ) {
	//		if ( limit && res.length > limit ) {
	//			res.length = limit;
	//		}
	//		if ( res.length ) {
	//			results[i] = res;
	//		}
	//		
	//		done();
	//	});
	//});
	//
	//done();
}

function K( obj ) {
	return !!obj;
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


function put_a( a ) {
	var s = '[\n ' + a.map( JSON.stringify ).join(',\n ') + '\n]';
	console.log( s );
}

init();
//setTimeout( init, 5000 );

