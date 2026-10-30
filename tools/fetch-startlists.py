#!/usr/bin/env python3
"""Télécharge les start lists listées dans data/startlist-sources.json (course -> URL du PDF), les convertit en « dossard|NOM Prénom|pays »
et les enregistre avec tools/startlist.js. Ne remplace jamais une start list si la lecture du PDF paraît douteuse. Ne touche pas aux courses déjà courues."""
import json, re, subprocess, sys, urllib.request, datetime, os
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36'}
NAT = set('BEL NED FRA GBR GER ITA IRL USA UKR CZE LUX NOR DEN SUI ESP CAN AUS POL AUT SWE FIN HUN SVK SLO JPN NZL BRA COL MEX ARG RSA ISR POR LAT EST LTU DEU CHE GRE CRO ROU BUL TUR KOR CHN'.split())
today = datetime.date.today().isoformat()
src = json.load(open('data/startlist-sources.json'))
sys.path.insert(0, 'tools')
os.makedirs('data/raw/startlists', exist_ok=True)
def parse(text):
    rows = []
    for l in text.splitlines():
        f = [x.strip() for x in re.split(r'\s{2,}', l.strip()) if x.strip()]
        if not f or not re.fullmatch(r'\d{1,3}', f[0]): continue
        nat = next((x for x in f[1:] if re.fullmatch(r'[A-Z]{3}', x) and x in NAT), None)
        name = next((x for x in f[1:] if re.search(r'[a-zà-ÿ]', x) and re.search(r'[A-ZÀ-Ý]{2}', x) and not re.fullmatch(r'[A-Z]{3}', x)), None)
        if name and nat: rows.append((int(f[0]), name, nat))
    return rows
rc = 0
for rid, url in src.items():
    ev = rid.split('-')[0]
    date = subprocess.run(['node', '-e', f"console.log(require('./js/data.js').RACES['{rid}'].date)"], capture_output=True, text=True).stdout.strip()
    if date and date < today: print(rid, ': course passée, ignorée'); continue
    try:
        b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        if b[:4] != b'%PDF': raise Exception('pas un PDF')
    except Exception as e:
        print(rid, ': téléchargement impossible', e); continue
    open(f'data/raw/startlists/{rid}.pdf', 'wb').write(b)
    txt = subprocess.run(['pdftotext', '-layout', f'data/raw/startlists/{rid}.pdf', '-'], capture_output=True, text=True).stdout
    open(f'data/raw/startlists/{rid}.txt', 'w').write(txt)
    rows = parse(txt)
    bibs = [r[0] for r in rows]
    if len(rows) < 10 or len(set(bibs)) != len(bibs):
        print(rid, ': lecture douteuse (', len(rows), 'lignes ), start list inchangée'); rc = 1; continue
    open(f'/tmp/sl-{rid}.txt', 'w').write('\n'.join(f'{a}|{b_}|{c}' for a, b_, c in rows) + '\n')
    r = subprocess.run(['node', 'tools/startlist.js', rid, f'/tmp/sl-{rid}.txt', '--source', url], capture_output=True, text=True)
    print(r.stdout.strip(), r.stderr.strip()); rc = rc or r.returncode
sys.exit(0)
