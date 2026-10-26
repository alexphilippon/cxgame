#!/usr/bin/env python3
"""Coupe du monde UCI de cyclo-cross : télécharge les classements complets (PDF officiels de ucicyclocrossworldcup.com) d'une saison
   et les convertit en texte brut -> data/raw/wc-<saison>/<date>_<lieu>_<catégorie>.txt  (+ index.json).
   Usage : python3 tools/fetch-wc-results.py 2025-2026   (lancé par l'Action GitHub « Résultats Coupe du monde »)"""
import re, sys, os, json, subprocess, urllib.request
season = sys.argv[1] if len(sys.argv) > 1 else '2025-2026'
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36'}
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read()
def parse(html):
    a = html.find(f'<h1>{season}</h1>')
    if a < 0: raise SystemExit('saison introuvable : ' + season)
    m = re.search(r'<h1>\d{4}\s*-\s*\d{4}</h1>', html[a + 10:])
    sec = html[a: a + 10 + m.start()] if m else html[a:]
    out = []
    for blk in re.split(r'<p class="accordion--uitslagen-location">', sec)[1:]:
        place = re.match(r'([^<]+)</p>', blk).group(1).strip()
        date = re.search(r'accordion--uitslagen-date">(\d\d)/(\d\d)/(\d\d)<', blk)
        iso = f'20{date.group(3)}-{date.group(2)}-{date.group(1)}'
        for cat, body in re.findall(r'<h3>([^<]+?)\s*:\s*</h3>(.*?)(?=<h3>|$)', blk, flags=re.S):
            pdf = re.search(r'href="([^"]+file_results/[^"]+\.pdf[^"]*)"', body)
            top3 = [re.sub(r'\s+', ' ', x).strip() for x in re.findall(r'<li class="ranking-top-3--flex">\s*<p>(.*?)</p>', body, flags=re.S)]
            out.append({'place': place, 'date': iso, 'cat': cat.strip(), 'pdf': pdf.group(1).replace('&amp;', '&') if pdf else None, 'top3': top3})
    return out
html = get('https://www.ucicyclocrossworldcup.com/en/results').decode('utf-8', 'ignore')
items = parse(html)
d = f'data/raw/wc-{season}'; os.makedirs(d, exist_ok=True)
for it in items:
    slug = re.sub(r'[^a-z0-9]+', '-', (it['date'] + ' ' + it['place'] + ' ' + it['cat']).lower()).strip('-')
    it['file'] = slug + '.txt'
    if not it['pdf']: continue
    try:
        pdf = f'{d}/{slug}.pdf'; open(pdf, 'wb').write(get(it['pdf']))
        txt = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True).stdout
        open(f'{d}/{slug}.txt', 'w').write(txt); os.remove(pdf)
    except Exception as e:
        it['error'] = str(e); print('ERREUR', slug, e)
json.dump(items, open(f'{d}/index.json', 'w'), ensure_ascii=False, indent=1)
print(len(items), 'classements,', sum(1 for i in items if i['pdf']), 'PDF')
