module('io', function( io ) {
	
	function xhrError( xhr, url ) {
		return new Error( "Error on reading '" + url + "' : " + xhr.status + " : " + xhr.statusText );
	}
	
	io.readFile = function readFile( path ) {
		var xhr = new XMLHttpRequest();
		xhr.open( "GET", path, false );
		xhr.send();
		return xhr.responseText;
	};
	
	io.readFileAsync = function readFileAsync( path, callback ) {
		var xhr = new XMLHttpRequest();
		
		xhr.onreadystatechange = function() {
			if ( xhr.readyState === 4 ) {
				xhr.onreadystatechange = null;
				
				if ( xhr.status === 0 || xhr.status === 200 ) {
					callback( null, xhr.responseText );
					
				} else {
					callback( xhrError(xhr, path), null );
				}
			}
		}
		
		xhr.open( "GET", path, true );
		xhr.send();
		return xhr;
	};
	
	(function(){
		var stack = [], loading, callback;
		
		io.loadLines = function( url, callback ) {
			stack.push({
				url: url,
				callback: callback
			});
			loadNext();
		};
		
		io.setLines = function( lines ) {
			loading = false;
			loadNext();
			callback && callback( lines );
		};
	
		function loadNext() {
			if ( stack.length ) {
				loading = true;
				var o = stack.shift();
				callback = o.callback;
				injectScript( o.url );
			}
		}
		
		function injectScript( url ) {
			console.log(url);
			var script = document.createElement('script');
			script.src = url;
			document.getElementsByTagName('head')[0].appendChild( script );
		}
	})();
	
});
