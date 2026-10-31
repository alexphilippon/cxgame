#!/usr/bin/env python3
"""Sonde 4 : API results.chronorace.be (HG Cross 25-26 et 26-27) -> data/raw/probe4/"""
import re, os, json, urllib.request, traceback
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept': 'application/json, text/plain, */*', 'Origin': 'https://www.acn-timing.com', 'Referer': 'https://www.acn-timing.com/'}
B = 'https://results.chronorace.be/api/'
d = 'data/raw/probe4'; os.makedirs(d, exist_ok=True)
log = []
def red(t): return re.sub(r'(?<![A-Za-z0-9_/-])(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_/-])', 'REDACTED', t)
def get(name, u, cap=200000):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60); b = r.read().decode('utf-8', 'ignore')
        open(f'{d}/{name}', 'w').write(red(b)[:cap]); log.append((name, u, 200, len(b))); return b
    except Exception as e:
        log.append((name, u, str(e), 0)); return ''
def main():
    h = open('data/raw/series/hgcross.html', errors='ignore').read()
    evs = re.findall(r'acn-timing\.com/\?lng=EN#/events/(\d+)/ctx/([0-9a-z_]+)/cms', h)
    evs = list(dict.fromkeys(evs))
    log.append(('events acn', len(evs)))
    for ev, ctx in evs:
        get(f'view-{ev}.json', B + f'Event/view/{ev}', 30000)
        get(f'list-{ev}.json', B + f'results/report/list/{ev}', 30000)
        get(f'gen-{ev}.json', B + f'results/generic/get/{ev}/{ctx}/CRO', 60000)
    for ev in ['2156533144205845', '2156533144205846', '2156533144205847']:
        get(f'view-{ev}.json', B + f'Event/view/{ev}', 30000)
        get(f'list-{ev}.json', B + f'results/report/list/{ev}', 30000)
try: main()
except BaseException: log.append(traceback.format_exc())
open(f'{d}/_log.txt', 'w').write('\n'.join(map(str, log)))
