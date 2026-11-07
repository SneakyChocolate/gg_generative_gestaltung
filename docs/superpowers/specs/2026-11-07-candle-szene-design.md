# Design: Kerze „ZEIT" (font/candle-szene)

Datum: 2026-11-07
Quelle: `.claude/PROMPT.md`, Rahmen aus `font/task.md`

## Idee

Das Wort **ZEIT** ist eine Kerze. Jeder Buchstabe hat einen Docht und brennt in ~2 Minuten gleichmäßig herunter. Wachs schmilzt nur nahe am Docht, Tropfen laufen ab, verschmelzen und sammeln sich auf dem Tisch. Dünne, heiße Teile brechen ab. Kerze = Vergänglichkeit, Wort = Zeit.

## Randbedingungen

- Nur Frontend, Three.js über CDN (importmap, `three@0.160.0`), ES-Module, lokaler Server nötig.
- Keine eigenen GLSL-Shader. Nur `MeshStandardMaterial` / `MeshPhysicalMaterial`, Addons aus `three/examples/jsm`.
- Feste Kamera, keine OrbitControls.
- Ziel: stabile 30+ FPS.
- Kommentare: **nur** Marker an Umschaltstellen (`// CONFIG:`, `// MODEL:`, `// PHYSICS:`, `// TABLE:`). Sonst selbsterklärende Namen, keine Inline-Kommentare.

## Module

Ordner `font/candle-szene/`:

| Datei | Aufgabe | Schnittstelle |
|---|---|---|
| `index.html` | importmap, Canvas, lädt `main.js` | – |
| `config.js` | alle Konstanten | `export const …` |
| `model.js` | Buchstaben-Meshes laden | `loadLetters(scene) → Promise<Letter[]>` mit `Letter = { mesh, restPositions, wick: Vector3, height }` |
| `heat.js` | Brennhöhe, Temperatur, Deformation, Vertex-Farben | `updateLetter(letter, burnHeight)`; reine Hilfsfunktionen `temperatureAt(distance)`, `waxColor(t)` |
| `grid.js` | XY-Zellraster, Säulenböden, Dochtspalte | `buildGrid`, `cellIndex`, `cellCenter`, `floorOf`, `tallestColumnX` |
| `breakage.js` | hängende Säulen, Brocken ablösen | `createBreakage(letter)`, `takeBrokenPieces(letter, breakage, burn) → Piece[]` |
| `drops.js` | Tropfen spawnen, mergen, als Metaballs rendern | `createDropSystem(scene, physics, letters)` → `{ update(dt, burnDt) }`; reine Funktion `mergeDrops(a, b)` |
| `physics/own.js` | eigene leichte Physik | siehe Physik-Schnittstelle |
| `physics/cannon.js` | dieselbe Schnittstelle mit `cannon-es@0.20.0` | siehe Physik-Schnittstelle |
| `flame.js` | Flamme pro Docht | `createFlame(scene) → { setPosition(v), update(time), extinguish() }` |
| `table.js` | Platzhalter-Tisch für Partner | `createTable(scene)`, nutzt `TABLE_Y` |
| `main.js` | Szene, Licht, Kamera, Loop, Tasten, FPS-Anzeige | – |
| `verify.html` | Asserts für reine Logik, Ausgabe im Browser | – |

## Modell-Quellen (`model.js`)

`CONFIG.MODEL_SOURCE`: `"text" | "gltf" | "fallback"`.

- **text:** `TextGeometry` pro Buchstabe (Font `helvetiker_bold.typeface.json` aus three/examples), nebeneinander gesetzt, Fuß auf `TABLE_Y`. Danach `toNonIndexed()` + `TessellateModifier` (maxEdgeLength aus Config), damit genug Vertices zum Verformen da sind.
- **gltf:** `GLTFLoader`, jedes Kind-Mesh = ein Buchstabe. Docht = Mitte der Bounding-Box oben.
- **fallback:** Zylinder pro Buchstabe. Wird auch genommen, wenn text/gltf beim Laden scheitert (catch → Warnung in Konsole).

Docht-Position: X = Spalte mit den meisten gefüllten Zellen (Mitte bevorzugt, z. B. Stamm von E und T), Z = Mitte, Y = Oberkante.

## Abbrennen & Hitze (`heat.js`)

- Brennhöhe pro Buchstabe: linear von Oberkante `top` zu `bottom = TABLE_Y − CRATER · reach²` in `BURN_SECONDS = 120` (reach = größter waagrechter Abstand Docht–Rand), damit am Ende auch die Ränder weg sind. Taste `F`: Zeitfaktor 1× ↔ 4×. Nach `BURN_SECONDS` Flamme aus.
- Docht sitzt auf `max(h, TABLE_Y)`.
- Temperatur pro Vertex: nur Abstand `d` zum **eigenen** Docht. `T = clamp(1 − d / HEAT_RADIUS, 0, 1)`. Weit weg → 0, starr.
- Form pro Vertex (aus Ruheposition `p0`):
  - Deckel: `y = min(p0.y, h + CRATER · r²)` (r = waagrechter Abstand zum Docht) → Mulde um den Docht, Ränder bleiben stehen.
  - Absacken: heiße Vertices zusätzlich `y −= SAG · T²`.
  - Nie unter den Boden der eigenen Wachssäule (`floors`, aus `grid.js`).
- Vertex-Farbe aus `T`: kaltes Elfenbein → warmes Gelb → Orange. Material: `MeshPhysicalMaterial` mit `vertexColors`, `roughness ~0.45`, `sheen` für Wachs-Look.
- Normals nach Update neu berechnen (`computeVertexNormals`), nur solange der Buchstabe brennt.
- Mesh wird beim Laden mit `mergeVertices` indiziert → weiche Normalen.

## Bruch (`breakage.js`)

- `grid.js` rastert jeden Buchstaben in XY-Zellen (`CELL_SIZE`). Zusammenhängende gefüllte Zellen übereinander = Wachssäule. Jede Säule kennt ihren Boden.
- Hängende Säule = Boden liegt über dem Tisch (Querbalken von E und T, Teile von Z). Nur die können brechen; sie tragen ihr Gewicht ohne Stütze von unten.
- Restdicke = `h + CRATER · dx² − Boden` (dx = waagrechter Abstand zum Docht).
- Bruch wenn `Restdicke · (1 − HEAT_WEAKENING · T) < BREAK_THICKNESS`. Hitze schwächt → heiße Säulen brechen früher und dicker.
- Brocken: Dreiecke der Säule werden im Buchstaben degeneriert (nicht mehr gezeichnet) und als eigenes Mesh (Farben übernommen) an die Physik gegeben (`addChunk`).
- Max. `MAX_CHUNKS` Brocken insgesamt, darüber verschwinden gebrochene Säulen nur.

## Physik-Schnittstelle (`physics/*.js`)

`CONFIG.PHYSICS_BACKEND`: `"own" | "cannon"`. `main.js` importiert dynamisch das passende Modul.

```
createPhysics({ gravity, tableY }) → {
  addDrop(position, radius, velocity) → body
  addChunk(mesh)                      → body
  remove(body)
  step(dt)
  position(body) → Vector3
  velocity(body) → Vector3
  isResting(body) → boolean
}
```

- **own:** Semi-implizites Euler, Schwerkraft, Tischebene: `y < tableY + r` → `y = tableY + r`, Geschwindigkeit auf 0 (Wachs klebt). Brocken: Parabel (Startgeschwindigkeit kleiner seitlicher Impuls + Schwerkraft), Rotation konstant, landet auf Tisch und bleibt liegen.
- **cannon:** `CANNON.World`, Plane-Body auf `tableY`, Tropfen = Sphere, Brocken = Box aus Bounding-Box. Hohe Dämpfung für Tropfen, damit sie nicht hüpfen. Mesh-Position/Rotation pro Frame aus Body kopiert.

## Flamme (`flame.js`)

- Zwei additive Sprites (innen hellgelb/weiß, außen orange) mit Canvas-Radialgradient-Textur, elongiert nach oben.
- Flackern: Skalierung + Opazität über überlagerte Sinus mit zufälliger Phase pro Flamme.
- Ein `PointLight` pro Docht (warm, kurze Reichweite), Intensität flackert mit.
- Docht: kleiner dunkler Zylinder unter der Flamme.

## Szene (`main.js`)

- Dunkler Raum, Hintergrund fast schwarz-warm, schwaches Hemisphere-Licht, Hauptlicht = die 4 Flammen.
- Kamera fest, leicht von oben-vorne auf das Wort.
- Tasten: `F` Zeitfaktor, `R` Neustart.
- FPS-Anzeige oben links (eigene Mittelung, kein stats.js nötig).
- Renderer: `antialias`, `ACESFilmicToneMapping`, Schatten aus (Performance).

## Tisch (`table.js`)

Graue Ebene auf `TABLE_Y`. `// TABLE:`-Marker: Partner ersetzt `createTable`. Physik kennt nur `TABLE_Y`, nicht das Mesh.

## Tests (`verify.html`)

Lädt Module, führt Asserts aus, zeigt PASS/FAIL:
1. `mergeDrops` erhält Volumen (`r³` Summe) und Masse-Schwerpunkt.
2. `temperatureAt(0) = 1`, `temperatureAt(HEAT_RADIUS) = 0`, monoton fallend.
3. Beide Physik-Backends: Tropfen über Tisch fällt, nach 3 s `y ≥ TABLE_Y` und `isResting`.
4. Brennhöhe Start = `top`, Ende = `bottom`.
5. Raster: stehende Säule Boden 0, hängende Säule Boden > 0.
6. Bruch über komplettes Abbrennen: I bleibt ganz, E und T verlieren Stücke.

Manuell im Browser: Optik, FPS ≥ 30 über komplettes Abbrennen.

## Nicht im Umfang

- OrbitControls, Schatten, eigene Shader, Sound.
- Wachsfluss als echte Flüssigkeits-Simulation (nur Tropfen + Metaballs).
- Tisch-Gestaltung (Partner).
