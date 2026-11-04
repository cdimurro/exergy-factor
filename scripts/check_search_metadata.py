"""Check public search metadata without running the calculator or sending data."""
from html.parser import HTMLParser
from pathlib import Path
import base64
import hashlib
import json
import struct
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SITE = 'https://exergyfactor.com'
PAGES = ['index.html', 'compare.html', 'methodology.html', 'api-key.html', 'privacy.html', 'terms.html']

class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta, self.canonical, self.data = {}, [], []
        self.jsonld = False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'meta':
            self.meta.setdefault(a.get('name') or a.get('property') or a.get('http-equiv'), []).append(a.get('content'))
        if tag == 'link' and a.get('rel') == 'canonical': self.canonical.append(a['href'])
        if tag == 'script': self.jsonld = a.get('type') == 'application/ld+json'
    def handle_endtag(self, tag):
        if tag == 'script': self.jsonld = False
    def handle_data(self, value):
        if self.jsonld: self.data.append(value)

for name in PAGES:
    p = Head()
    p.feed((ROOT / name).read_text(encoding='utf-8'))
    expected = SITE + ('/' if name == 'index.html' else '/' + name)
    assert p.canonical == [expected], name
    for key in ['description', 'robots', 'og:title', 'og:description', 'og:url', 'og:image', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']:
        assert len(p.meta.get(key, [])) == 1 and p.meta[key][0], (name, key)
    assert p.meta['og:url'] == [expected]
    assert p.meta['description'] == p.meta['og:description'] == p.meta['twitter:description']
    assert 'noindex' not in p.meta['robots'][0]
    assert len(p.data) == 1
    schema = json.loads(p.data[0])
    assert schema['@context'] == 'https://schema.org' and schema['@graph']
    digest = base64.b64encode(hashlib.sha256(p.data[0].encode()).digest()).decode()
    assert "'sha256-" + digest + "'" in p.meta['Content-Security-Policy'][0]
    assert 'unsafe-inline' not in p.meta['Content-Security-Policy'][0]
image = (ROOT / 'social-preview.png').read_bytes()
assert image[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', image[16:24]) == (1200, 630)
xml = ET.parse(ROOT / 'sitemap.xml')
assert len(xml.findall('{*}url')) == len(PAGES)
assert (ROOT / 'llms.txt').is_file()
print('Passed search metadata, structured data, CSP and image checks for six public pages.')
