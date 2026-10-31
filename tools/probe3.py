#!/usr/bin/env python3
"""Sonde 3 : cherche dans les scripts d'ACN Timing les appels d'API de résultats -> data/raw/probe3/"""
import re, os, urllib.request, urllib.parse, traceback
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36'}
d = 'data/raw/probe3'; os.makedirs(d, exist_ok=True)
log = []
def red(t): return re.sub(r'(?<![A-Za-z0-9_/-])(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_/-])', 'REDACTED', t)
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read().decode('utf-8', 'ignore')
def main():
    base = 'https://www.acn-timing.com/'
    h = get(base + '?lng=EN'); idx = [urllib.parse.urljoin(base, s) for s in re.findall(r'src="([^"]+\.js[^"]*)"', h)]
    main_js = get(idx[0]); files = sorted(set(re.findall(r'assets/[A-Za-z0-9_.\-]+\.js', main_js)))
    log.append(('chunks', len(files)))
    out = []
    for f in files:
        try: t = get(base + f)
        except Exception as e: log.append((f, str(e))); continue
        for m in re.finditer(r'(?:eventsApiUrlBase|xresultsApiUrlBase|resultsApiUrlBase|crApiUrlBase)"\)\s*\+\s*[`"\'][^;]{0,160}', t):
            out.append(f'{f}: ' + red(m.group(0)))
        for m in re.finditer(r'\.get\(`?\$?\{?[^;]{0,40}(?:Results?|results?|event)[^;]{0,140}', t):
            out.append(f'{f} GET: ' + red(m.group(0))[:240])
    open(f'{d}/api-calls.txt', 'w').write('\n'.join(sorted(set(out)))[:60000])
try: main()
except BaseException: log.append(traceback.format_exc())
open(f'{d}/_log.txt', 'w').write('\n'.join(map(str, log)))
