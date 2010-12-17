//localStorage.clear();

var manifest = JSON.parse( io.readFile('./manifest.json') );
console.log( manifest.name + ' ' + manifest.version );

var _options = options.init({
	"tooltip.onStay.enabled": true,
	"tooltip.onStay.delay": 400,
	"tooltip.showRect": false,
	"tooltip.limit": 4,
	"tooltip.exactsFirst": true,
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

var dicts = [],
	_push = dicts.push,
	_slice = dicts.slice,
	
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
		
		dicts.push( dict );
		
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
			lookup( req.term, req.limit, req.exactsFirst, send );
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
			utils.remove( dicts, dict );
			delete dictInfo[ dict.name ];
			dict.free();
			next();
			
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


function lookup( term, limit, exactsFirst, callback ) {
	var arr = [],
		n2go = dicts.length + 1;
	
	term = term.trim().replace(/\s+/g, ' ').replace(/^[\-\—]+|[\-\—]+$/g, '');
	
	function done( error ) {
		error && reportError( error );
		if ( --n2go === 0 ) {
			var first = [];
			if ( exactsFirst ) {
				for ( var i = 0, l = arr.length; i < l; ++i ) {
					if ( arr[i][0].term === term ) {
						first.push( arr[i].shift() );
					}
				}
			}
			callback( first.concat.apply(first, arr) );
		}
	}
	
	dicts.forEach(function( dict ) {
		dict.lookup(term, done, function( results ) {
			if ( limit && results.length > limit ) {
				results.length = limit;
				
			}
			
			if ( results.length ) {
				arr.push( results );
			}
			
			done();
		});
	});
	
	done();
}

function put_a( a ) {
	var s = '[\n ' + a.map( JSON.stringify ).join(',\n ') + '\n]';
	console.log( s );
}

init();
//setTimeout( init, 5000 );

