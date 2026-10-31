#!/usr/bin/env python3
"""Sonde 5 : variantes d'appels à l'API de résultats (ACN/Chronorace) -> data/raw/probe5/"""
import re, os, urllib.request, traceback
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept': 'application/json, text/plain, */*', 'Origin': 'https://www.acn-timing.com', 'Referer': 'https://www.acn-timing.com/'}
d = 'data/raw/probe5'; os.makedirs(d, exist_ok=True)
log = []
def red(t): return re.sub(r'(?<![A-Za-z0-9_/-])(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_/-])', 'REDACTED', t)
n = [0]
def get(u, cap=20000):
    n[0] += 1; name = f'r{n[0]:02d}.txt'
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60); b = r.read().decode('utf-8', 'ignore')
        open(f'{d}/{name}', 'w').write(red(b)[:cap]); log.append((name, u, r.status, r.headers.get('Content-Type'), len(b)))
    except Exception as e:
        log.append((name, u, str(e), '', 0))
def main():
    ev, ctx = '2152959731400316', '20251004_exact'
    for base in ['https://results.chronorace.be/api/', 'https://prod.chronorace.be/api/', 'https://www.acn-timing.com/api/']:
        get(base + f'Event/view/{ev}', 6000)
        get(base + f'results/generic/get/{ev}/{ctx}/CRO', 6000)
        get(base + f'results/generic/raw/{ev}/{ctx}/CRO', 6000)
        get(base + f'results/generic/uci/{ev}/{ctx}', 6000)
        get(base + f'results/report/list/{ev}', 6000)
    for ev2 in ['2156533144205845']:
        for base in ['https://results.chronorace.be/api/', 'https://prod.chronorace.be/api/']:
            get(base + f'Event/view/{ev2}', 6000); get(base + f'results/report/list/{ev2}', 6000)
    get(f'https://results.chronorace.be/api/results/generic/get/{ev}/{ctx}/CRO?key=', 6000)
    get(f'https://results.chronorace.be/api/results/generic/get/{ev}/{ctx}/cro', 6000)
    get(f'https://results.chronorace.be/api/results/generic/get/{ev}/{ctx}/CROSS', 6000)
    get(f'https://results.chronorace.be/api/results/generic/get/{ev}/{ctx}/RES', 6000)
    get(f'https://results.chronorace.be/api/results/generic/get/{ev}/{ctx}/', 6000)
try: main()
except BaseException: log.append(traceback.format_exc())
open(f'{d}/_log.txt', 'w').write('\n'.join(map(str, log)))
