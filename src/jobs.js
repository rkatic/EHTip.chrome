module('jobs', function( exports, require, module ) {

	var parse = JSON.parse,
		dump = JSON.stringify,
		slice = [].slice;

	function A( a, i ) {
		return slice.call( a, i|0 );
	}

	exports.createJobDealer = function( path, cmd, stayAlive, errorCb ) {
		var worker,
			timeout_id,
			nJobs = 0;

		function terminate() {
			worker && worker.terminate();
			timeout_id && clearTimeout( timeout_id );
			worker = timeout_id = null;
		}

		function onError( error ) {
			if ( ( errorCb && errorCb(error) ) !== false ) {
				terminate();
			}
		}

		function jobFinished( job ) {
			if ( !worker ) return;
			worker.removeEventListener('error', job.error, true);
			if ( --nJobs === 0 ) {
				if ( !stayAlive ) {
					terminate();

				} else if ( typeof stayAlive === 'number' && isFinite( stayAlive ) ) {
					timeout_id = setTimeout( terminate, stayAlive );
				}
			}
		}

		return function( s ) {
			if ( timeout_id ) {
				clearTimeout( timeout_id );
				timeout_id = null;
			}

			if ( !worker ) {
				worker = module.spawn( path );
				worker.addEventListener('error', onError, false);
			}

			var channel = new MessageChannel();
			var job = createJob( channel.port1, jobFinished );
			worker.addEventListener('error', job.error, true);
			worker.postMessage(dump([ cmd, s, A(arguments,1) ]), [ channel.port2 ]);

			++nJobs;

			return job;
		};
	};

	exports.createJobResolverHandler = function( cmd, callbacks ) {
		return function( event ) {
			var m = event.data && parse( event.data );
			if ( m instanceof Array && m[0] === cmd ) {
				var cb = callbacks[ m[1] ] || callbacks.default;
				if ( cb ) {
					var job = createJob( event.ports[0] );
					cb.apply( job, m[2] );
				}
			}
		}
	};

	exports.addJobResolverTo = function( worker, cmd, callbacks ) {
		var onMessage = exports.createJobResolverHandler( cmd, callbacks );
		worker.addEventListener('message', onMessage, false);
		return onMessage;
	};

	function createJob( port, finishCb ) {
		var job,
			finished = false;

		function resolve( s, args, received ) {
			if ( finished ) {
				return;
			}

			if ( !received ) {
				send( s, args );
			}

			if ( s === 'done' || s === 'fail' || s === 'error' ) {
				finished = true;
				port.close();
				finishCb && finishCb( job );
			}

			if ( job.on[ s ] ) {
				job.on[ s ].apply( job.on, args );

			} else if ( job.on['...'] ) {
				job.on['...'].call( job.on, s, args, !received );
			}
		}

		function send( s, args, tr ) {
			port.postMessage(dump([ s, args ]), tr);
		}

		job = {
			on: {},
			send: function( s ) {
				send( s, A(arguments,1) );
			},
			resolve: function( s ) {
				resolve( s, A(arguments,1) );
			},
			request: function( s ) {
				var args = A( arguments, 1 );
				var cb = args.pop();
				var channel = new MessageChannel();
				channel.port1.onmessage = function( event ) {
					channel.port1.close();
					cb.apply( null, parse(event.data) );
				};
				send( s, args, [channel.port2] );
			},
			done: function() {
				resolve( 'done', A(arguments) );
			},
			fail: function() {
				resolve( 'fail', A(arguments) );
			},
			error: function() {
				resolve( 'error', A(arguments) );
			}
		};

		port.onmessage = function( event ) {
			var m = parse( event.data );
			var port = event.ports && event.ports[0];
			if ( port ) {
				m[1].push(function() {
					port.postMessage(dump( A(arguments) ));
				});
			}
			resolve( m[0], m[1], true );
		};

		return job;
	}

	exports.createJob = createJob;
});
