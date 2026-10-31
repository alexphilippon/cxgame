#!/usr/bin/env python3
"""HG Cross (ex-Exact Cross) : récupère les classements via l'API Chronorace/ACN Timing -> data/raw/hg/<ctx>-<groupe>.json
Groupes : 31 Hommes Élite, 32 Femmes Élite, 34 Hommes Juniors, 35 Femmes Juniors. Saisons 2025-26 et 2026-27 (dates >= 2025-08-01)."""
import re, os, json, urllib.request, urllib.error
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept': 'application/json, text/plain, */*', 'Origin': 'https://www.acn-timing.com', 'Referer': 'https://www.acn-timing.com/'}
RES = 'https://results.chronorace.be/api/'; PROD = 'https://prod.chronorace.be/api/'
d = 'data/raw/hg'; os.makedirs(d, exist_ok=True)
def get(u):
    try: return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read().decode('utf-8', 'ignore')
    except Exception as e: print('échec', u, e); return ''
html = open('data/raw/series/hgcross.html', errors='ignore').read()
ids = list(dict.fromkeys(re.findall(r'acn-timing\.com/\?lng=EN#/events/(\d+)/ctx', html) + re.findall(r'chronorace\.be/Classements/ListeRapports\.aspx\?eventId=(\d+)', html)))
strip = lambda s: re.sub(r'<[^>]+>', '', str(s or '')).strip()
n = 0
for ev in ids:
    v = get(PROD + f'Event/view/{ev}')
    if not v: continue
    try: info = json.loads(v)
    except Exception: continue
    date = (info.get('StartDate') or '')[:10]
    m = re.search(r'/ctx/([0-9a-z_]+)', (info.get('Parameters') or {}).get('Redirect', ''))
    if not m or date < '2025-08-01': continue
    ctx = m.group(1)
    for g in ['31', '32', '34', '35']:
        t = get(RES + f'results/table/search/{ctx}/RES{g}?srch=&pageSize=500')
        if not t.strip(): continue
        try: j = json.loads(t)
        except Exception: continue
        grp = (j.get('Groups') or [])
        if not grp: continue
        rows = []
        for r in grp[0].get('SlaveRows') or []:
            pos = str(r[0] or '').strip().rstrip('.')
            nm = re.search(r'<b>(.*?)</b>', str(r[2]))
            if not nm: continue
            nat = (re.search(r'flags/([a-z]{3})', str(r[3])) or [0, ''])[1].upper()
            raw = ' '.join(strip(x) for x in r[-3:]).upper()
            if pos.isdigit(): rows.append([int(pos), strip(nm.group(1)), nat, ''])
            else:
                st = 'DNF' if 'DNF' in raw else 'DSQ' if ('DSQ' in raw or 'DQ' in raw) else 'DNS' if ('DNS' in raw or 'NA' in raw.split() or raw.strip() in ('', '0:00')) else ''
                if st: rows.append([st, strip(nm.group(1)), nat, ''])
        out = {'event': ev, 'ctx': ctx, 'title': info.get('Title'), 'place': info.get('Location'), 'date': date, 'group': g, 'rows': rows}
        json.dump(out, open(f'{d}/{ctx}-{g}.json', 'w'), ensure_ascii=False)
        n += 1; print(ctx, g, len(rows), 'lignes')
print(n, 'classements')
