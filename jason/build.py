#!/usr/bin/env python3
"""Assemble index.html and stamp a new build id everywhere.
Run after every change:  python3 build.py
Telegram caches mini-app files hard — the build id in ?v= and version.json forces a refresh."""
import re, time, pathlib
root = pathlib.Path(__file__).parent
build = time.strftime('%Y%m%d%H%M')

base_css = (root / 'src/base.css').read_text()
html = (root / 'src/head.html').read_text() + base_css + (root / 'src/extra.css').read_text() + (root / 'src/body.html').read_text()
html = html.replace('__BUILD__', build)
(root / 'index.html').write_text(html)

app = (root / 'app.js').read_text()
app = re.sub(r"var BUILD = '[^']*';", "var BUILD = '%s';" % build, app)
(root / 'app.js').write_text(app)
(root / 'version.json').write_text('{ "v": "%s" }\n' % build)
print('build', build)
