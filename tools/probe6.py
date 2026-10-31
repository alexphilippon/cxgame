#!/usr/bin/env python3
"""Sonde 6 : ouvre les pages de résultats ACN Timing dans un navigateur et enregistre les appels réseau -> data/raw/probe6/"""
import re, os, json, traceback
from playwright.sync_api import sync_playwright
d = 'data/raw/probe6'; os.makedirs(d, exist_ok=True)
log = []
def red(t): return re.sub(r'(?<![A-Za-z0-9_/-])(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_/-])', 'REDACTED', t)
PAGES = {
  'm1': 'https://www.acn-timing.com/?lng=EN#/events/2152959731400316/ctx/20251004_exact/cms/CRO',
  'dend': 'https://www.acn-timing.com/?lng=EN#/events/2156533144205845/ctx/20261011_hg/cms',
}
def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        for k, u in PAGES.items():
            pg = b.new_page(viewport={'width': 1200, 'height': 1400}); calls = []
            def on(r, calls=calls):
                try:
                    if r.request.resource_type in ('xhr', 'fetch'):
                        body = r.text() if r.status < 400 else ''
                        calls.append({'url': red(r.url), 'status': r.status, 'len': len(body), 'head': red(body[:600])})
                        if len(body) > 200 and 'results' in r.url: open(f'{d}/{k}-body{len(calls)}.json', 'w').write(red(body)[:150000])
                except Exception as e: calls.append({'err': str(e)})
            pg.on('response', on)
            pg.goto(u); pg.wait_for_timeout(9000)
            open(f'{d}/{k}-text.txt', 'w').write(red(pg.inner_text('body'))[:20000])
            pg.screenshot(path=f'{d}/{k}.png')
            # liens/boutons cliquables de résultats
            links = pg.eval_on_selector_all('a', 'els => els.map(e => [e.innerText.trim().slice(0,60), e.getAttribute("href")]).filter(x => x[1])')
            open(f'{d}/{k}-links.json', 'w').write(red(json.dumps(links, ensure_ascii=False))[:20000])
            json.dump(calls, open(f'{d}/{k}-calls.json', 'w'), ensure_ascii=False, indent=1)
            pg.close()
        b.close()
try: main()
except BaseException: log.append(traceback.format_exc())
open(f'{d}/_log.txt', 'w').write('\n'.join(map(str, log)))
