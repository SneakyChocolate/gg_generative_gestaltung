# ZEIT – Kerze aus Text

Starten: im Ordner `python3 -m http.server 8765`, dann http://localhost:8765 öffnen.
Tests: http://localhost:8765/verify.html (Titel zeigt PASS / FAIL).

Tasten: `F` 4× schneller, `R` neu starten.

## Module

| Datei | Aufgabe |
|---|---|
| `config.js` | alle Zahlen und Umschalter (`// CONFIG:`, `// PHYSICS:`, `// TABLE:`) |
| `model.js` | lädt Text, glTF oder Fallback-Zylinder, verdichtet das Mesh, setzt Docht (`// MODEL:`) |
| `grid.js` | rastert jeden Buchstaben in Wachssäulen (XY-Zellen), weiß wo jede Säule beginnt |
| `heat.js` | Brennhöhe, Temperatur pro Vertex (nur Abstand zum eigenen Docht), Verformung, Farbe |
| `breakage.js` | hängende Säulen, die dünn und heiß werden, brechen als Brocken ab |
| `drops.js` | Tropfen entstehen auf der Vorderseite, gleiten, fallen, verschmelzen (Metaballs), liegende Tropfen werden als Pfütze gezeichnet |
| `physics/own.js` | eigene Physik: Schwerkraft, Euler-Schritt, Tischebene, Brocken werden auf dem Tisch ausgerichtet |
| `physics/cannon.js` | gleiche Schnittstelle mit cannon-es |
| `flame.js` | Flamme aus zwei Sprites + flackerndes Punktlicht |
| `table.js` | Platzhalter-Tisch für den Partner |
| `main.js` | Szene, Licht, Kamera, Loop, Brocken als konvexe Hülle, HUD |

## Ablauf pro Frame

Zeit → Brennhöhe pro Buchstabe → `updateLetter` verformt und färbt → `takeBrokenPieces` löst Brocken → Physik → Tropfen spawnen, gleiten, mergen, rendern → Bild.

## Kräfte und Regeln

- **Abbrennen:** jeder Vertex wird auf `Brennhöhe + CRATER · r²` gedeckelt (r = waagrechter Abstand zum Docht). Ergebnis: Mulde um den Docht, Ränder bleiben stehen.
- **Hitze:** `T = 1 − Abstand / HEAT_RADIUS`, nur zum eigenen Docht. Heißes Wachs sackt um `SAG · T²` ab und wird orange.
- **Bruch:** Säulen, die nicht auf dem Tisch stehen (hängend, z. B. Querbalken von E und T), brechen, wenn `Restdicke · (1 − HEAT_WEAKENING · T) < BREAK_THICKNESS`.
- **Brocken:** werden als konvexe Hülle (`ConvexGeometry`) mit gemittelter Wachsfarbe erzeugt, also als geschlossener Körper statt offener Schale. Winzige Splitter unter `MIN_CHUNK_SIZE` werden nur aus dem Buchstaben entfernt, nicht an die Physik gegeben. Maximal `MAX_CHUNKS` Brocken. Gelandete Brocken werden so verschoben, dass ihr tiefster Punkt auf `TABLE_Y` liegt.
- **Tropfen:** spawnen nur auf der Vorderseite (zur Kamera) an heißen Stellen und gleiten im Zeitraffer mit. Berühren sich zwei Tropfen, entsteht einer mit gleichem Volumen (`r = ∛(r1³ + r2³)`) am Massenschwerpunkt. Metaballs verschmelzen optisch schon vorher.
- **Tisch:** Physik kennt nur `TABLE_Y`. Liegende Tropfen werden, sobald sie den Tisch berühren, als flache, eingesunkene Kugeln gezeichnet → Pfütze. Metaball-Felder werden nur neu berechnet, wenn sich etwas bewegt oder abkühlt.
- **Licht:** neben den Flammen-Punktlichtern gibt es ein schwaches warmes Fülllicht aus Kamerarichtung (`FILL_*` in `config.js`). Es hält die Vorderseiten lesbar und die Szene nach dem Erlöschen nicht schwarz.

## Umschalten

- Modell: `MODEL_SOURCE` in `config.js` (`"text"`, `"gltf"`, `"fallback"`). Bei Ladefehler automatisch Fallback.
- Physik: `PHYSICS_BACKEND` (`"own"`, `"cannon"`).
- Tisch: `createTable` in `table.js` ersetzen, Oberkante auf `TABLE_Y`.

## Performance

Bei unter 30 FPS zuerst `MC_RESOLUTION` von 48 auf 40 senken, dann `TESSELLATE_EDGE` von 0.05 auf 0.07 erhöhen.
