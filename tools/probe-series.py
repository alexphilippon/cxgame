#!/usr/bin/env python3
"""Sonde X²O Trofee + HG Cross : sauvegarde les pages brutes dans data/raw/probe/ pour écrire les parseurs."""
import re, os, urllib.request, urllib.parse, subprocess
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language': 'nl,fr,en;q=0.8'}
d = 'data/raw/probe'; os.makedirs(d, exist_ok=True)
import traceback
log = []
def main():
    global log
    def get(u):
        r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60)
        return r.read(), r.headers.get('Content-Type', '')
    def save(name, u):
        try:
            b, ct = get(u)
            out = b
            if b[:4] != b'%PDF':   # texte : on masque les clés et jetons (GitHub bloque les pushs qui en contiennent)
                t = b.decode('utf-8', 'ignore')
                t = re.sub(r'(?<![A-Za-z0-9_/-])(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_/-])', 'REDACTED', t)
                out = t.encode()
            if name.endswith('.js'):   # scripts : on ne garde que les adresses et chemins d'API
                t = b.decode('utf-8', 'ignore')
                found = set(re.findall(r'https?://[^\s"\'`)<>\\]{6,120}', t)) | set(re.findall(r'["\'`](/?(?:api|rest|data|events|results|ctx|cms|rankings?)[A-Za-z0-9_/\-.{}$:]{0,80})["\'`]', t))
                out = '\n'.join(sorted(found)[:400]).encode(); name = name[:-3] + '.urls.txt'
            open(f'{d}/{name}', 'wb').write(out); log.append((name, u, 200, ct, len(b))); return b
        except Exception as e:
            log.append((name, u, str(e), '', 0)); return b''
    # Chronorace (HG Cross 26-27)
    for i, ev in enumerate(['2156533144205845', '2156533144205846', '2156533144205847']):
        b = save(f'chrono-{ev}.html', f'https://prod.chronorace.be/Classements/ListeRapports.aspx?eventId={ev}')
        for j, l in enumerate(dict.fromkeys(re.findall(r'href="([^"]+\.pdf[^"]*)"', b.decode('utf-8', 'ignore'), re.I))):
            u = urllib.parse.urljoin('https://prod.chronorace.be/Classements/', l)
            pb = save(f'chrono-{ev}-{j}.pdf', u)
            if pb[:4] == b'%PDF':
                open(f'{d}/chrono-{ev}-{j}.txt', 'w').write(subprocess.run(['pdftotext', '-layout', f'{d}/chrono-{ev}-{j}.pdf', '-'], capture_output=True, text=True).stdout)
    # ACN Timing (HG Cross 25-26) : page + scripts + points d'API courants
    b = save('acn-home.html', 'https://www.acn-timing.com/?lng=EN')
    html = b.decode('utf-8', 'ignore')
    for j, s in enumerate(re.findall(r'src="([^"]+\.js[^"]*)"', html)[:6]):
        save(f'acn-js-{j}.js', urllib.parse.urljoin('https://www.acn-timing.com/', s))
    for k, u in enumerate(['https://www.acn-timing.com/api/events/2152959731400316', 'https://www.acn-timing.com/api/events/2152959731400316/ctx/20251004_exact/cms/CRO',
                           'https://api.acn-timing.com/events/2152959731400316', 'https://www.acn-timing.com/data/events/2152959731400316']):
        save(f'acn-try-{k}.txt', u)
    # X²O Trofee
    for k, u in enumerate(['https://www.x2otrofee.be/', 'https://x2otrofee.be/uitslagen/', 'https://x2otrofee.be/resultaten/', 'https://x2otrofee.be/klassement/', 'https://x2otrofee.be/results/']):
        b = save(f'x2o-{k}.html', u)
        for j, l in enumerate(list(dict.fromkeys(re.findall(r'href="([^"]+\.pdf[^"]*)"', b.decode('utf-8', 'ignore'), re.I)))[:30]):
            pb = save(f'x2o-{k}-{j}.pdf', urllib.parse.urljoin(u, l))
            if pb[:4] == b'%PDF':
                open(f'{d}/x2o-{k}-{j}.txt', 'w').write(subprocess.run(['pdftotext', '-layout', f'{d}/x2o-{k}-{j}.pdf', '-'], capture_output=True, text=True).stdout)

try:
    main()
except BaseException:
    log.append(traceback.format_exc())
open(f'{d}/_log.txt', 'w').write('\n'.join(map(str, log)))
print(len(log), 'éléments')
