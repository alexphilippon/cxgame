#!/bin/bash
# Sonde les sources de résultats cyclo-cross (lancée par l'Action « Sonde des sources ») : statut HTTP + début de page, dans data/raw/probe2/.
mkdir -p data/raw/probe2; : > data/raw/probe2/_status.txt
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
i=0
while read -r u; do
  [ -z "$u" ] && continue; i=$((i+1))
  f="data/raw/probe2/$(printf '%02d' $i).html"
  code=$(curl -sS -L -m 40 -A "$UA" -H 'Accept-Language: fr,en;q=0.8' -o "$f" -w '%{http_code} %{size_download}' "$u" 2>&1 || echo ERR)
  echo "$i $code $u" >> data/raw/probe2/_status.txt
  head -c 400000 "$f" > "$f.tmp" && mv "$f.tmp" "$f"
done <<'URLS'
https://www.ucicyclocrossworldcup.com/en/results
https://www.ucicyclocrossworldcup.com/en/calendar/2025-2026/hoogerheide-5
https://www.ucicyclocrossworldcup.com/en/calendar/2025-2026
https://dataride.uci.org/iframe/Events/
https://firstcycling.com/
https://firstcycling.com/race.php?r=9
https://cyclingflash.com/location/hoogerheide-4
https://cyclingflash.com/race/uci-cyclo-cross-world-cup-hoogerheide-2026
https://www.wielerflits.nl/
https://www.sporza.be/nl/categorie/wielrennen/veldrijden/
https://en.wikipedia.org/wiki/2025%E2%80%9326_UCI_Cyclo-cross_season
https://en.wikipedia.org/wiki/2025%E2%80%9326_Superprestige
https://en.wikipedia.org/wiki/2025%E2%80%9326_X%C2%B2O_Badkamers_Trofee
https://www.crossresults.com/
URLS
cat data/raw/probe2/_status.txt
