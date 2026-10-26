#!/bin/bash
# Sonde les sources de résultats cyclo-cross (lancée par l'Action « Sonde des sources ») : statut HTTP + début de page, dans data/raw/probe/.
mkdir -p data/raw/probe; : > data/raw/probe/_status.txt
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
i=0
while read -r u; do
  [ -z "$u" ] && continue; i=$((i+1))
  f="data/raw/probe/$(printf '%02d' $i).html"
  code=$(curl -sS -L -m 40 -A "$UA" -H 'Accept-Language: fr,en;q=0.8' -o "$f" -w '%{http_code} %{size_download}' "$u" 2>&1 || echo ERR)
  echo "$i $code $u" >> data/raw/probe/_status.txt
  head -c 400000 "$f" > "$f.tmp" && mv "$f.tmp" "$f"
done <<'URLS'
https://www.cyclocross24.com/
https://www.cyclocross24.com/results/
https://www.cyclocross24.com/calendar/
https://www.procyclingstats.com/race/uci-cyclo-cross-world-cup/2026
https://www.procyclingstats.com/races.php?year=2026&circuit=24&filter=Filter
https://www.procyclingstats.com/race/cyclocross-world-championships/2026/result
https://en.wikipedia.org/wiki/2025%E2%80%9326_UCI_Cyclo-cross_World_Cup
https://en.wikipedia.org/wiki/2026_UCI_Cyclo-cross_World_Championships
https://www.uci.org/discipline/cyclo-cross/6jDXXpqzCaMCHZEhjCKgz
https://dataride.uci.org/
https://www.cyclingstage.com/
https://cyclinguptodate.com/cyclocross-calendar
https://www.the-sports.org/cyclo-cross-ranking-s13.html
https://www.sportsdb.org/
URLS
cat data/raw/probe/_status.txt
