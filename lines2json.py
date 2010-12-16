import codecs
import json

def main( src, dst ):
	lines = codecs.open( src, mode='r', encoding='utf-8' ).read().splitlines()
	
	data = json.dumps( lines, separators=(',\n',':'), check_circular=False );
	
	open( dst, 'w' ).write( data )

if __name__=='__main__':
	import sys
	main( sys.argv[1], sys.argv[2] )
