#!/usr/bin/env python3
"""Sonde 7 : ouvre chaque course HG Cross/Exact Cross (ACN Timing), clique sur chaque « Results » et enregistre les réponses -> data/raw/probe7/"""
import re, os, json, traceback
from playwright.sync_api import sync_playwright
d = 'data/raw/probe7'; os.makedirs(d, exist_ok=True)
log = []
def red(t): return re.sub(r'(?<![A-Za-z0-9_/-])(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_/-])', 'REDACTED', t)
def main():
    h = open('data/raw/series/hgcross.html', errors='ignore').read()
    evs = list(dict.fromkeys(re.findall(r'acn-timing\.com/\?lng=EN#/events/(\d+)/ctx/([0-9a-z_]+)/cms', h)))
    evs += [('2156533144205845', '20261011_hg'), ('2156533144205846', ''), ('2156533144205847', '')]
    with sync_playwright() as p:
        b = p.chromium.launch()
        for ev, ctx in evs:
            pg = b.new_page(viewport={'width': 1200, 'height': 1400}); got = []
            def on(r, got=got):
                try:
                    if r.request.resource_type in ('xhr', 'fetch') and 'chronorace' in r.url and r.status < 400:
                        got.append((red(r.url), r.text()))
                except Exception: pass
            pg.on('response', on)
            url = f'https://www.acn-timing.com/?lng=EN#/events/{ev}/ctx/{ctx}/cms' if ctx else f'https://www.acn-timing.com/?lng=EN#/events/{ev}'
            try:
                pg.goto(url); pg.wait_for_timeout(5000)
                n = pg.get_by_text('Results', exact=True).count()
                log.append((ev, ctx, 'boutons Results', n))
                for i in range(n):
                    before = len(got)
                    try:
                        pg.get_by_text('Results', exact=True).nth(i).click(timeout=5000); pg.wait_for_timeout(3500)
                    except Exception as e: log.append((ev, i, 'clic', str(e)[:100])); continue
                    title = ''
                    try: title = pg.inner_text('body')[:300].replace('\n', ' | ')
                    except Exception: pass
                    for j, (u, t) in enumerate(got[before:]):
                        if 'generic/uci' in u and 'key=cms' in u: continue
                        open(f'{d}/{ev}-{i}-{j}.json', 'w').write(json.dumps({'url': u, 'page': title, 'body': red(t)[:200000]}, ensure_ascii=False))
                    pg.go_back(); pg.wait_for_timeout(1500)
                    if pg.get_by_text('Results', exact=True).count() != n:
                        pg.goto(url); pg.wait_for_timeout(4000)
            except Exception as e: log.append((ev, 'erreur', str(e)[:200]))
            pg.close()
        b.close()
try: main()
except BaseException: log.append(traceback.format_exc())
open(f'{d}/_log.txt', 'w').write('\n'.join(map(str, log)))
