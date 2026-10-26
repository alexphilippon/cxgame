#!/usr/bin/env python3
"""Superprestige et HG Cross (ex-Exact Cross) : récupère les pages de résultats et les fichiers « Voir tous » -> data/raw/series/ (texte brut pour analyse)."""
import re, os, subprocess, urllib.request, json
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language': 'fr,en;q=0.8'}
def get(u):
    r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60)
    return r.read(), r.headers.get('Content-Type', '')
d = 'data/raw/series'; os.makedirs(d, exist_ok=True)
log = []
for name, u in [('superprestige', 'https://www.superprestigecyclocross.be/fr/r%C3%A9sultat'), ('hgcross', 'https://hgcross.be/uitslagen/')]:
    try:
        b, ct = get(u); open(f'{d}/{name}.html', 'wb').write(b); log.append((name, 200, len(b)))
    except Exception as e:
        log.append((name, str(e), 0)); continue
    if name != 'superprestige': continue
    html = b.decode('utf-8', 'ignore')
    links = list(dict.fromkeys(re.findall(r'href="((?:https://www\.superprestigecyclocross\.be)?/fr/files/[^"]+)"', html)))
    for i, l in enumerate(links[:400]):
        url = l if l.startswith('http') else 'https://www.superprestigecyclocross.be' + l
        try:
            fb, ct = get(url); ext = 'pdf' if fb[:4] == b'%PDF' else 'bin'
            p = f'{d}/sp-{i:03d}.{ext}'; open(p, 'wb').write(fb)
            if ext == 'pdf':
                open(f'{d}/sp-{i:03d}.txt', 'w').write(subprocess.run(['pdftotext', '-layout', p, '-'], capture_output=True, text=True).stdout); os.remove(p)
            log.append((url, ct, len(fb)))
        except Exception as e:
            log.append((url, str(e), 0))
open(f'{d}/_log.txt', 'w').write('\n'.join(map(str, log)))
print(len(log), 'éléments')
