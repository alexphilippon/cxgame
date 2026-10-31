#!/usr/bin/env python3
"""Sonde 2 : API ACN/Chronorace + pages de résultats X²O -> data/raw/probe2/ (clés masquées)."""
import re, os, json, urllib.request, urllib.parse, traceback
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept': 'application/json,text/html,*/*'}
d = 'data/raw/probe2'; os.makedirs(d, exist_ok=True)
log = []
def red(t): return re.sub(r'(?<![A-Za-z0-9_/-])(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_/-])', 'REDACTED', t)
def get(u):
    r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60)
    return r.read(), r.headers.get('Content-Type', '')
def save(name, u, limit=400000):
    try:
        b, ct = get(u); t = red(b.decode('utf-8', 'ignore'))[:limit]
        open(f'{d}/{name}', 'w').write(t); log.append((name, u, 200, ct, len(b))); return t
    except Exception as e:
        log.append((name, u, str(e), '', 0)); return ''
def main():
    # 1) Script ACN : extraits autour des appels d'API
    js = ''
    try:
        h, _ = get('https://www.acn-timing.com/?lng=EN'); h = h.decode('utf-8', 'ignore')
        src = re.findall(r'src="([^"]+\.js[^"]*)"', h)
        for s in src:
            b, _ = get(urllib.parse.urljoin('https://www.acn-timing.com/', s)); js += b.decode('utf-8', 'ignore')
    except Exception as e: log.append(('js', str(e)))
    snips = []
    for pat in [r'apiUrlBase', r'eventsApiUrlBase', r'results/', r'/events/', r'genericresult', r'\.get\(`', r'/ctx/']:
        for m in list(re.finditer(pat, js))[:12]:
            snips.append(f'## {pat}\n' + red(js[max(0, m.start() - 160):m.end() + 260].replace('\n', ' ')))
    open(f'{d}/acn-snippets.txt', 'w').write('\n\n'.join(snips))
    # 2) Essais d'API
    ev = '2152959731400316'
    for k, u in enumerate([f'https://prod.chronorace.be/api/events/{ev}', f'https://prod.chronorace.be/api/results/{ev}', f'https://prod.chronorace.be/api/events/{ev}/results',
                           f'https://prod.chronorace.be/api/v1/events/{ev}', f'https://cr-results-cis.azurewebsites.net/api/events/{ev}', f'https://prod.chronorace.be/api/ctx/20251004_exact/events/{ev}',
                           'https://prod.chronorace.be/api/events/2156533144205845', 'https://prod.chronorace.be/api/results/2156533144205845']):
        save(f'api-{k}.txt', u, 60000)
    # 3) Pages X²O / Koppenbergcross
    for k, u in enumerate(['https://x2otrofee.be/uitslagen/uitslagen-vlaamse-duinencross-2025', 'https://x2otrofee.be/klassement-elite-mannen/', 'https://x2otrofee.be/klassement-elite-vrouwen/',
                           'https://koppenbergcross.be/uitslagen-en-erelijst/', 'https://x2otrofee.be/wp-sitemap.xml', 'https://x2otrofee.be/wp-sitemap-posts-page-1.xml',
                           'https://x2otrofee.be/palmares/', 'https://x2otrofee.be/wp-json/wp/v2/pages?per_page=100&_fields=link,title']):
        save(f'x2o-{k}.html', u, 250000)
try: main()
except BaseException: log.append(traceback.format_exc())
open(f'{d}/_log.txt', 'w').write('\n'.join(map(str, log)))
print(len(log), 'éléments')
