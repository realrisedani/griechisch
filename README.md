# Ελληνικά · 20 Minuten am Tag

Danis persönliches Griechisch-Lernprogramm als PWA. Läuft im Browser, lässt sich am Handy auf den Homescreen legen und funktioniert komplett offline.

## Was drin ist

- **Kern-100**: die 100 häufigsten Wörter des gesprochenen Griechisch (Verben, Artikel, Pronomen, Partikeln, Verbinder, Fragewörter, Zeit, Ort).
- **Alltags-Sets**: Café, Einkaufen, Zuhause, Zeit & Wetter, Gefühle & Smalltalk, Zahlen.
- **Selbst-Check (Tag 1)**: Kern-100 einmal durchwischen, kenn ich / unsicher / kenn ich nicht. Daraus entsteht der Plan.
- **Session (20 Min)**: Wiederholen (Spaced Repetition, SM-2) → neue Wörter → festigen → Satzbau-Drill. Timer stoppt automatisch.
- **Satzmuster**: die 10 Muster, mit denen 80 % des Alltags gebaut werden.
- **Aussprache**: griechische Stimme des Geräts (Web Speech API), offline.
- **Offline**: Service Worker lädt alles vor. Oben rechts steht „Offline bereit“, dann geht es ohne Netz weiter.

## Fortschritt

Liegt lokal auf dem Gerät (localStorage). Unter „Mehr“ als JSON sichern und wiederherstellen.

## Entwickeln

Kein Build-Schritt. Beliebigen Static-Server auf den Ordner richten:

```bash
python3 -m http.server 7701
```

Neue Wörter: `data/woerter.js` erweitern (`[id, el, de, typ, set, beispiel_el, beispiel_de, info]`).

**Vor jedem Deploy** `VERSION` in `sw.js` hochzählen, sonst bleibt bei Nutzern der alte Cache aktiv.

## Deploy

Netlify, Ordner-Root wird veröffentlicht (`netlify.toml`).

```bash
netlify deploy --prod --dir .
```
