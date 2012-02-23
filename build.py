#!/usr/bin/env python
import zipfile
import os
import re
from os.path import join
import codecs
import json


re_ignore = re.compile(r'.*\.db|_.*|\..*', re.I)

def build(root):

    manifest_path = join( root, 'manifest.json' )
    manifest_data = codecs.open( manifest_path, mode='r', encoding='utf-8' ).read()

    manifest = json.loads( manifest_data )

    manifest['name'] = re.sub( r'\s*\(.*?\)', '', manifest['name'] )
    del manifest['update_url']

    manifest_ofile = codecs.open( manifest_path, mode='w', encoding='utf-8' )

    json.dump( manifest, manifest_ofile )
    manifest_ofile.close()


    pos = len(root)

    dirname, basename = os.path.split(root)
    basename = '%s-%s.zip' % ( manifest['name'], manifest['version'] )

    print basename

    z = zipfile.ZipFile( join(dirname, basename), 'w', zipfile.ZIP_DEFLATED )

    for root, dirs, files in os.walk(root):
        for name in files:
            if re_ignore.match( name ):
                continue

            path = join( root, name )
            z.write( path, path[pos:] )

    z.close()

    manifest_ofile = codecs.open( manifest_path, mode='w', encoding='utf-8' )
    manifest_ofile.write( manifest_data )


if __name__=='__main__':
    try:
       build('src')
    except Exception, er:
        print '\aERROR:', er
    raw_input('Done.')
