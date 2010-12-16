var re = {};
(function( re ) {
	
var _map = [].map;

var pat = {
    wordRanges: "\\w\\u00c0-\\uFFFF",
    notWordRanges: "\\u0001-\\u002F\\u003A-\\u0040\\u005B-\\u0060\\u007B-\\uFFFF",
    fromWords: function( words ) {
        return ''.concat(
			"(?:^|", pat.notWordClass, ")(",
            _map.call( words, escape ).join('|'),
            ")(?:$|", pat.notWordClass, ")"
        );
    }
};

pat.wordClass = "[" + pat.wordRanges + "]";
pat.notWordClass = "[^" + pat.wordRanges + "]";


function getFlags( regex ) {
    return ( regex.global     ? "g" : "" ) +
           ( regex.ignoreCase ? "i" : "" ) +
           ( regex.multiline  ? "m" : "" ) +
           ( regex.sticky     ? "y" : "" );
};

function addFlags( regex, flags ) {
    flags = ( getFlags(regex) + flags ).replace(/(.)(?=[\s\S]*\1)/g, "");
    var ret = new RegExp( regex.source, flags );
    ret._groupNames = regex._groupNames;
    return ret;    
}

var _compile_re = /(\\w)|(\\W)|(\\.)|(\])|(\[)|(\s+|#.*)|\(((?!\?)|\?<([$\w]+)>)|\\k<([\w$]+)>(\d?)|(\.)/g;

function compile( pattern, flags ) {
    var dotall, verbose, unicode,
        names = [undefined], inclass = false;
    
    if ( flags ) {
        dotall    = flags.indexOf('s') > -1;
        unicode   = flags.indexOf('u') > -1; // \b is not translated!
        varbose   = flags.indexOf('x') > -1;
        flags = flags.replace(/[sux]/g, "");
    }
    
    pattern = pattern.replace(_compile_re, function(all, word, notword, escape, endclass, startclass, toremove, group, name, backname, num, dot) {
        if ( escape ) {
            return escape;
		}
            
        if ( word ) {
            return !unicode ? word : inclass ? pat.wordRanges : pat.wordClass;
        }
        
        if ( notword ) {
            return !unicode ? notword : inclass ? pat.notWordRanges : pat.notWordClass;
        }
        
        if ( endclass ) {
            inclass = false;
            return endclass;
        }
        
        if ( !inclass ) {
        
            if ( startclass ) {
                inclass = true;
                return startclass;
            }
            
            if ( toremove ) {
                return verbose ? "" : toremove;
            }
            
            if ( group ) {
                names.push( name );
                return "(";
            }
            
            if ( backname ) {
                return "\\" + names.indexOf( backname ) + ( num ? "(?:)" + num : "" );
            }
            
            if ( dot && dotall ) {
                return "[\\s\\S]";
            }
        }
        
        return all;
    });
    
    var ret = new RegExp( pattern, flags || "" );
    ret._groupNames = names;
    return ret;
}


function _fixMatch( m, regex ) {
    var names = regex._groupNames;
    
    if ( m && names ) {
        var i = names.length;
        while ( --i ) {
            if ( names[i] ) {
                m[ names[i] ] = m[ i ];
            }
		}
    }
    
    return m;
}

function exec( str, pattern, flags ) {
    var regex = typeof pattern === "string" ? compile( pattern, flags ) :
        flags ? addFlags( pattern, flags ) : pattern;

    return _fixMatch( regex.exec( str ), regex );
}

function sub( str, pattern, repl, flags ) {
    var regex = typeof pattern === "string" ? compile( pattern, flags ) :
        flags ? addFlags( pattern, flags ) : pattern;
    

    if ( typeof repl === "string" ) {
        var names = regex._groupNames;
    
        if (names) repl = repl.replace(/((?:^|[^$])\$)\{([$\w]+)\}/g, function(all, pre, name) {
            return pre + names.indexOf( name );    
        });
        
        return str.replace( regex, repl );
    }
    
    var g = regex.global;
    
    if ( g ) regex.lastIndex = 0;
    
    var res, m, index, pos = 0, parts = [];
    
    while (( m = regex.exec(str) )) {
        parts.push( str.substring(pos, m.index), repl( _fixMatch(m, regex) ) );
        pos = regex.lastIndex;
        if ( !g ) break;
    }
    
    parts.push( str.substring(pos) );
    
    if ( g ) regex.lastIndex = 0;
        
    return parts.join("");
}



function escape( str ) {
    return str.replace(/[-[\]{}()*+?.\\^$|,#\s]/g, '\\$&');
}

re.pat = pat;
re.getFlags = getFlags;
re.addFlags = addFlags;
re.compile = compile;
re.exec = exec;
re.sub = sub;
re.escape = escape;

})( re );
