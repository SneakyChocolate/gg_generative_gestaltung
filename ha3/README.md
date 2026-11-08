# Weihnachten — eine Kerze aus Text

Interaktive 3D-Szene für das Modul **Generative Gestaltung**. Das Wort
`WEIHNACHTEN` besteht aus elf einzelnen Buchstaben-Meshes. Jeder Buchstabe
trägt einen Docht und brennt langsam von oben nach unten ab. Hitze, Schwerkraft,
Wind, Luftwiderstand, Oberflächenspannung und eine Tischkollision formen das
Wachs, lassen Tropfen fallen, Pfützen verschmelzen und dünne Buchstaben
abbrechen.

Die Szene läuft vollständig im Browser. Es gibt keinen Build-Schritt und kein
Backend. Three.js und die Schrift werden über ein CDN geladen.

---

## 1. Starten

```bash
# im Ordner ha4/ha3
python3 -m http.server 8080
# danach http://127.0.0.1:8080/index.html öffnen
```

Ein lokaler Server ist empfehlenswert, weil der Browser die Schriftdatei und
die Three.js-Module sonst je nach Einstellung blockiert. Für die Abgabe genügt
es, `index.html`, `sketch.js`, den Ordner `js/` und dieses `README.md` zu
zippen. Es müssen keine Bilder, Fonts oder Modelle mitgeliefert werden; alle
Texturen werden zur Laufzeit mit Canvas 2D erzeugt.

**Bedienung**

| Eingabe | Wirkung |
|---|---|
| Maus bewegen | Windrichtung und Windstärke (x/z) |
| `R` | Kerze neu anzünden, alle Tropfen/Pfützen/Splitter löschen |
| `P` | Pause / weiter |
| `D` | Debug-Overlay mit FPS, Kräften und Systemzählern |
| `H` | HUD ein-/ausblenden |
| Fenster ändern | Kamera und Renderer passen sich an |

Nach 92 Sekunden startet die Szene automatisch neu (weiches Ausblenden). So
bleibt eine Ausstellung oder ein Screenshot-Terminal immer in einem guten
Zustand.

**Debug-Schnittstelle für die Präsentation**

In der Browser-Konsole stehen drei kleine Hilfen bereit:

```js
window.__CANDLE__.state       // FPS, Teile, Tropfen, Pfützen, Splitter, ...
window.__CANDLE__.CONFIG      // alle Stellschrauben
window.__CANDLE_ERRORS__      // gesammelte Laufzeitfehler (sollte leer sein)
```

---

## 2. Idee und Zusammenhang

Weihnachten ist warm, ruhig und vergänglich. Eine Kerze ist das passende
Objekt: Sie verbraucht sich, während sie Licht gibt. Das Wort ist nicht nur
Dekoration, sondern **die Kerze selbst**. Die Buchstaben sind aus Wachs, jeder
Docht sitzt auf einem Buchstaben. Wenn das Wachs schmilzt, wird das Wort
buchstäblich unleserlich — die Bedeutung und der physikalische Prozess sind
dasselbe.

Die Farben sind keine Dekoration, sondern ein Temperatursensor:

| Zustand | Farbe | Bedeutung |
|---|---|---|
| kalt | Elfenbein / Creme | Wachs bei Raumtemperatur |
| warm | Honig / Orange | erhitzt, beginnt zu schmelzen |
| heiß | Rotglut | direkt an der Flamme, kurz vor dem Tropfen |

Die Umgebung ist ein weihnachtliches Stillleben: dunkle Holzplatte, grüner
Läufer, Gold- und Rotkugeln, ein Tannenzweig, warmer Bokeh, Staub und Rauch.
Die Kamera bleibt bewusst ruhig und cinematisch; die Bewegung kommt aus der
Simulation, nicht aus der Kamera.

---

## 3. Architektur

Der Code ist in logisch getrennte ES-Module unter `js/` aufgeteilt.
`sketch.js` ist der p5.js-konforme Einstiegspunkt und enthält ausschließlich
`setup()` und `draw()`. Da die Szene technisch mit Three.js läuft, übernimmt
`main.js` die Aufgabe, die sonst p5.js erledigt: Er ruft `setup()` einmal auf
und danach `draw()` über `requestAnimationFrame` in einer Schleife.

```
index.html                 HTML, CSS und Import Map
sketch.js                  nur setup() und draw()
js/
├── main.js                p5.js-konformer Runner (requestAnimationFrame)
├── config.js              CONFIG und COLORS — alle Stellschrauben
├── utils.js               clamp, lerp, rand, smoothstep
├── state.js               gemeinsamer Laufzeit-Zustand
├── renderer.js            scene, camera, renderer
├── environment.js         Licht, Tisch, Deko, Staub/Bokeh, Kamera
├── textures.js            prozedurale Canvas-Texturen
├── materials.js           alle Materialien
├── model.js               TextGeometry / GLTF / OBJ / Fallback
├── input.js               Maus, Tastatur, Sichtbarkeit
├── engine.js              init, Reset, Debug, Simulationsschritt
├── physics/
│   ├── topology.js        Vertex-Verschweißung, Nachbarschaften, Normalen
│   ├── slicing.js         Mesh-Schnitt und Deckflächen
│   └── candle-part.js     CandlePart: Hitze, Schmelzen, Bruch
└── systems/
    ├── wick.js            Docht und Flamme
    ├── smoke.js           Rauch
    ├── droplets.js        Tropfen
    ├── puddles.js         Pfützen (Metaballs oder Discs)
    └── shards.js          Splitter
```

**Datenfluss pro Frame**

```
Maus ──► windTarget ──► wind (geglättet)
                          │
Dochte ──► Hitze pro Vertex ──► Temperatur ──► Schmelzen/Farbe
                          │                        │
                          ├──► Stress ──► Bruch ──► Splitter
                          └──► Tropfen ──► Pfützen ──► Verschmelzen
                                                   │
Tischkollision (CONFIG.tableY) ◄───────────────────┘
```

Jeder Buchstabe ist ein eigenes Mesh. Weil `TextGeometry` non-indexed ist,
verschweißt `buildMeshTopology()` die Dreiecksecken zunächst über ihre
Position zu logischen Vertices. Jeder logische Vertex kennt seine Nachbarn
und seine Ruhekanten. Darauf laufen Wärmeleitung, Fluid-Relaxation und
Abstandserhaltung. Die Dochte kennen die lokale Position ihres Buchstabens
und liefern die Wärmequelle im lokalen Raum. Nach einem Bruch wird die
aktuelle, bereits geschmolzene Form zur neuen Ruhelage des Reststücks.

---

## 4. Kräfte und Regeln

### 4.1 Wärme

Für jeden logischen Vertex wird der Abstand `d` zum nächsten aktiven Docht
gemessen. Es gibt zwei Zonen:

```
Kern   = max(0, 1 - d² / radius²)²
Halo   = max(0, 1 - d² / haloRadius²)² * haloStrength
Ziel   = max(Kern, Halo)
```

Der Kern sitzt direkt an der Flamme, der breite Halo macht schon vorher die
Nachbarschaft weich. Zusätzlich leitet jeder Vertex Wärme entlang der
Mesh-Kanten weiter:

```
T[u] += (Mittelwert der Nachbar-Temperaturen - T[u]) * diffusion * dt
```

Die Temperatur folgt träge: Aufheizen ist schneller als Abkühlen. Das ist
wichtig, damit die Buchstaben nach dem Abbrand langsam auskühlen und die
Farbe nicht sofort zurückspringt. Nur der nächste Docht zählt, damit sich
benachbarte Buchstaben nicht gegenseitig aufheizen.

### 4.2 Schmelzen

Oberhalb einer Schwelle beginnt das Wachs zu sacken. Heiße Vertices werden
stärker von der Schwerkraft gezogen:

```
melt       = smoothstep(meltThreshold, 1, Temperatur)
gravityBias = 0.62 + Temperatur * 1.05
sag        += melt * sagRate * gravityBias * dt      (gedeckelt durch maxSag)
Position.y  = max(0.003, Ruhelage.y - sag)
Position.xz = Ruhelage.xz + Normale.xz * sag * normalFlow
```

Der Schmelzweg wird anschließend über die Nachbarschaft geglättet, damit
keine einzelnen Stacheln entstehen. Danach folgt eine Fluid-Relaxation:
Heiße Vertices gleiten leicht in Richtung des Nachbarschaftsmittelpunkts.
Zu nah gekommene heiße Vertices stoßen sich über ihre Ruhekanten ab
(`repulsion`, `minSpacing`). So bleibt das Volumen sichtbar, statt in eine
dünne Fläche zu kollabieren.

Der Docht liest über `surfaceHeightNear()` die aktuelle Wachsoberfläche und
wandert mit ihr nach unten. Die Flamme schwebt deshalb nicht über dem
geschmolzenen Buchstaben.

Das Schmelzen ist irreversibel: Ein Vertex, der einmal gesackt ist, bleibt
unten. Die Normale lässt die Seiten leicht nach außen quellen, damit die
Buchstaben nicht nur dünner werden, sondern wirklich weich wirken.

### 4.3 Farbe

Die Vertexfarbe wird aus zwei Mischungen berechnet: kalt → warm → heiß.
`MeshPhysicalMaterial` mit `vertexColors` übernimmt den Rest. Zusätzlich
tragen Clearcoat, Sheen und die Raumreflexion zum Wachseindruck bei. Es gibt
**keinen eigenen GLSL-Shader**; die Farbe entsteht aus Standardmaterial und
Vertexfarben.

### 4.4 Tropfen

Ein Tropfen entsteht an einem zufälligen Rand-Vertex eines heißen Buchstabens.
Er erbt dessen Temperatur und startet mit einer kleinen seitlichen
Geschwindigkeit. Pro Frame:

```
v.y -= gravity * dt
v *= max(0, 1 - drag * dt)          Luftwiderstand
v.xz += wind.xz * dropPush * dt     Wind
p += v * dt
```

Wenn `p.y - radius <= CONFIG.tableY`, landet der Tropfen und wird zu einer
Pfütze. Zwei Tropfen in der Luft verschmelzen, wenn ihr Abstand kleiner als
`0.86 · (r1 + r2)` ist; das neue Volumen ist die Summe der Kugelvolumina.

### 4.5 Pfützen und Oberflächenspannung

Eine Pfütze ist logisch ein Volumen mit einer Dicke. Der sichtbare Radius
folgt aus der Volumenerhaltung:

```
radius = sqrt(Volumen / (π * Dicke))
```

Beim Verschmelzen werden Mittelpunkt, Dicke und Temperatur nach Volumen
gewichtet. Das Volumen bleibt exakt erhalten. Die Pfütze kühlt langsam ab und
wird dadurch dunkler.

**Metaball-Modus (`physicsMode: 'metaballs'`)**

Jede Pfütze wird als weicher Radialgradient auf ein Canvas 2D gezeichnet.
Mehrere Gradienten werden additiv überlagert (`globalCompositeOperation =
'lighter'`). So entsteht eine gemeinsame Äquipotentialfläche: Benachbarte
Tropfen fließen sichtbar ineinander, obwohl nur 2D-Kreise gezeichnet werden.
Das Canvas wird als Farb- und Bump-Textur auf eine flache Tischplatte gelegt.
Das ist eine bewusst performante 2D-Projektion der Metaball-Idee, kein
Partikel-Fluid.

**Disc-Modus (`physicsMode: 'discs'`)**

Alternativ wird jede Pfütze als einzelne abgeflachte Kugel über ein
`InstancedMesh` gezeichnet. Das ist schneller und hat härtere Kanten, wirkt
aber weniger organisch. Die Logik (Volumen, Verschmelzen, Kollision) ist
identisch.

### 4.6 Bruch

Jeder Buchstabe sammelt Stress, solange er brennt. Belastet wird nicht die
reine Zeit, sondern die heiße Wachsmasse oberhalb der Buchstabenmitte:

```
load   = Summe(Temperatur - bridgeHeat) / Vertexanzahl   (nur obere Hälfte)
stress += (load * 6.4 + heißerAnteil * 0.65) * dt
```

Die Bruchschwelle hängt von der Buchstabenbreite ab: Dünne Buchstaben wie `I`
brechen früher als breite wie `W`. Kurz vor dem Bruch wird eine schräge
Bruchebene gewählt und der Bereich um diese Ebene in X/Z zusammengezogen
(`necking`). Dadurch hängt der Lappen sichtbar an einem dünnen Steg.

Beim eigentlichen Bruch wird das Mesh an dieser Ebene **wirklich
durchgeschnitten**, nicht nur Dreiecke entfernt:

1. `sliceGeometry()` teilt jedes Dreieck in positive und negative Hälften.
2. Die Schnittkanten werden zu Ringen verkettet.
3. `buildSliceCaps()` schließt jeden Ring mit einer Wachs-Deckfläche.
4. Das positive Teil wird ein eigenes, geschlossenes Splitter-Mesh; das
   negative Teil bleibt als Hauptstück stehen.

Weil beide Hälften gecappt sind, sieht man keine offenen Rückseiten oder das
Mesh-Innere. Die Materialien laufen deshalb mit `THREE.FrontSide`. Der
Splitter fliegt parabolisch, prallt mit kleiner Rückstoßgeschwindigkeit vom
Tisch ab, bleibt liegen und schmilzt nach einigen Sekunden zu einer Pfütze.
Die aktuelle, bereits geschmolzene Form des Hauptstücks wird zur neuen
Ruhelage; früher geschmolzenes Wachs springt nicht zurück. Der Docht sucht
sich anschließend den höchsten Punkt der neuen Oberfläche.

Beim Schnitt und beim starken Einsinken entstehen zwangsläufig einzelne
Dreiecke mit Fläche 0. Deren Vertexnormalen heben sich auf und werden zu
`(0, 0, 0)`. In GLSL liefert `normalize(0)` NaN; dieses NaN landet im
HDR-Ziel des Composers und der Bloom-Pass verschmiert es über das ganze
Bild (komplett schwarze Frames). Deshalb prüft `fixDegenerateNormals()`
jede erzeugte Normale und ersetzt degenerierte Werte durch die sichere
Ersatzrichtung `(0, 1, 0)`. `sanitizeGeometryAttributes()` kontrolliert
zusätzlich Positionen und Farben neuer Geometrien auf NaN/Inf. Mit dieser
Absicherung bleibt der HDR-Puffer auch nach vielen Brüchen endlich und der
Bloom stabil.

### 4.7 Wind und Kamera

Die Maus setzt ein Windziel, das exponentiell geglättet wird. Der Wind bewegt
Flammen, Tropfen und Staub. Die Kamera ist fest und wird nur beim Resize an
die Wortbreite angepasst. Das hält die Komposition ruhig und macht die
Simulation lesbar.

---

## 5. Modelle wechseln

In `CONFIG` (Abschnitt `0. CONFIG`) gibt es drei Quellen:

```js
// 1) TextGeometry aus einer Three.js-Schrift (Standard)
model: 'text',

// 2) Externes Modell (GLB/GLTF oder OBJ)
model: 'external',
externalModelUrl: 'models/kerze.glb',

// 3) Immer verfügbarer Ersatz
model: 'fallback',
```

**Regeln des Modell-Loaders**

- `.glb` / `.gltf` → `GLTFLoader`
- `.obj` → `OBJLoader`
- Alle Mesh-Geometrien werden zu einer Geometrie verschmolzen.
- Das Modell wird auf Höhe `1.55` skaliert, im Modellraum auf `y = 0` gesetzt
  und in x/z zentriert.
- Die Anzahl der Dochte ergibt sich aus der Breite (`width / 1.15`, mindestens
  eins). Bei `'text'` bekommt jeder Buchstabe genau einen Docht.
- Schlägt das Laden fehl (leere URL, Netzwerkfehler, unbekanntes Format), fällt
  die Szene automatisch auf den Zylinder zurück und läuft weiter.

Für ein externes Modell muss die Datei neben `index.html` liegen und über
denselben lokalen Server erreichbar sein. Der Ordnername `models/` ist nur ein
Beispiel.

**Tipp:** Für ein neues Wort genügt `CONFIG.word`. Großbuchstaben sind
empfohlen, weil dann alle Dochte auf derselben Höhe sitzen und die elf
Flammen eine ruhige Reihe bilden. Kleinschreibung funktioniert ebenfalls; die
Dochte sitzen dann auf dem jeweiligen Hochpunkt.

---

## 6. Physik wechseln

```js
physicsMode: 'metaballs',   // weich, organisch, Canvas-Textur
physicsMode: 'discs',       // schnell, harte Kanten, InstancedMesh
```

Die Umschaltung erfolgt vor dem Laden der Seite. Für einen Test zur Laufzeit:

```js
window.__CANDLE__.state.puddles.setMode('discs');
```

Beide Modi teilen dieselbe Pfützenlogik. Der Unterschied liegt nur in der
Darstellung. `metaballs` zeichnet pro Frame zwei Canvas-Texturen neu;
`discs` aktualisiert nur Instanzmatrizen und ist auf schwachen Geräten die
günstigere Wahl.

---

## 7. Tischkollision und Partner-Integration

Die einzige Kopplung zwischen Simulation und Umgebung ist:

```js
tableY: 0
```

Alle relevanten Systeme benutzen ausschließlich diesen Wert:

- Modellgruppe (`model.group.position.y = CONFIG.tableY`)
- Dochte und Flammen
- fallende Tropfen (`p.y - radius <= CONFIG.tableY`)
- Pfützenplatte (`CONFIG.tableY + 0.006`)
- Splitter (`box.min.y < CONFIG.tableY`)
- Staub, Kamera, Lichter und Deko

Wenn die Kerze in die Szene eines Partners gesetzt werden soll, reicht es,
`CONFIG.tableY` auf die dortige Tischhöhe zu setzen. Die dekorative Umgebung
(Tischplatte, Läufer, Kugeln, Zweig, Hintergrund) liegt in
`setupEnvironment()` und kann entfernt werden, ohne die Simulation zu
beeinflussen. Die Pfützenplatte bleibt als flache, halbtransparente Fläche bei
`tableY`, damit die Pfützen weiterhin auf dem Tisch liegen.

**Wichtig:** Die Szene arbeitet in Weltunits. Ein Buchstabe ist etwa `0.9`
Einheiten hoch, der Tisch steht bei `y = 0`. Der Partner sollte die Kerze
entsprechend skalieren oder `tableY` in seinem Koordinatensystem setzen.

---

## 8. Performance

Gemessen in Firefox (headless, 1600 × 814) mit der Melt-/Fracture-Version:

| Zeit | FPS | Buchstaben | Tropfen | Pfützen | Splitter |
|---|---|---|---|---|---|
| 6 s | 60 | 11 | 0 | 3 | 0 |
| 18 s | 60 | 11 | 0 | 12 | 8 |
| 30 s | 60 | 11 | 0 | 23 | 7 |
| 42 s | 60 | 11 | 0 | 22 | 6 |
| 54 s | 60 | 11 | 0 | 26 | 4 |
| 66 s | 60 | 11 | 0 | 27 | 1 |

Die Splitterzahl schwankt, weil liegende Splitter nach einigen Sekunden
vollständig zu Pfützen aufschmelzen.

Maßnahmen:

- Weiche Vertexnormalen werden nur alle drei Frames neu berechnet; die
  Bewegung ist langsam genug, dass dazwischen nichts hart wirkt. Die
  Kanten-Nachbarschaft wird einmal pro Mesh-Umbau aufgebaut.
- `InstancedMesh` für Tropfen und Pfützen-Discs; Splitter sind wegen ihrer
  geringen Zahl (max. 10) einzelne Meshes.
- Ein Schatten werfendes Licht (1024²), Punktlichter nur an jedem zweiten
  Docht.
- `devicePixelRatio` auf `1.65` begrenzt.
- Pfützen-Canvas mit fester Auflösung (768 px Breite), Höhe an das
  Weltseitenverhältnis angepasst.
- Staub, Bokeh und Rauch als kleine Sprite-Pools mit fester Obergrenze.
- Bloom nur einmal pro Frame; `CONFIG.bloom = false` schaltet ihn komplett ab.
- Alle Systeme haben harte Obergrenzen (`maxDrops`, `puddles.max`,
  `shards.max`, `smoke.max`), damit die Szene nicht unendlich wächst.

---

## 9. Bewusste Vereinfachungen

Diese Punkte sind wichtig für die Verteidigung der Arbeit:

1. **Wachs ist kein echtes Fluid.** Die Buchstaben sind deformierbare Meshes.
   Schmelzen ist eine vertikale Verschiebung mit Nachbarschaftsglaettung und
   Abstandserhaltung, keine Navier-Stokes-Simulation. Das ist visuell
   überzeugend und bleibt bei 60 FPS beherrschbar.
2. **Metaballs sind eine 2D-Projektion.** Die Addition der Radialgradienten
   erzeugt eine weiche Äquipotentialfläche, aber keine echte 3D-Oberfläche.
   Deshalb liegt die Pfütze flach auf dem Tisch.
3. **Volumen bleibt erhalten, aber es verdunstet nichts.** Beim Verschmelzen
   wird das Kugelvolumen addiert; Verdunstung wird nicht simuliert. Das ist
   eine bewusste Entscheidung für eine stabile, vorhersehbare Szene.
4. **Die Kamera ist statisch.** Die Aufgabe verlangt ein Environment und
   Kräfte; eine bewegte Kamera würde die Lesbarkeit der feinen Wachsbewegung
   verschlechtern.
5. **Keine externen Bilddateien.** Holz, Stoff, Flamme, Rauch und Hintergrund
   sind Canvas-Texturen. Das hält die Abgabe klein und macht die Herkunft
   jedes Pixels nachvollziehbar.

---

## 10. Quellen

- Three.js r160 — Dokumentation und Beispiele:
  <https://threejs.org/docs/> · <https://github.com/mrdoob/three.js>
- `TextGeometry` / `FontLoader`:
  <https://threejs.org/docs/#api/en/geometries/TextGeometry>
- `InstancedMesh`:
  <https://threejs.org/docs/#api/en/objects/InstancedMesh>
- `MeshPhysicalMaterial` (Clearcoat, Sheen, Transmission):
  <https://threejs.org/docs/#api/en/materials/MeshPhysicalMaterial>
- `RoomEnvironment` und PMREM:
  <https://threejs.org/docs/#api/en/environments/RoomEnvironment>
- `EffectComposer`, `UnrealBloomPass`, `OutputPass`:
  <https://threejs.org/docs/#examples/en/postprocessing/EffectComposer>
- Schrift **Gentilis Bold** aus den Three.js-Beispielen:
  `examples/fonts/gentilis_bold.typeface.json`
- Daniel Shiffman, *The Nature of Code*, Kapitel 6 (Kraft, Masse, Reibung,
  Schwerkraft): <https://natureofcode.com/>
- Metaball-Grundidee (Summe von Einzelfeldern, Äquipotentialfläche):
  <https://en.wikipedia.org/wiki/Metaballs>
- Canvas 2D `globalCompositeOperation = 'lighter'`:
  <https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation>

Die Umsetzung, alle Formeln und alle Texturen sind eigenständig aus diesen
Grundlagen abgeleitet. Es werden keine fertigen Shader, Partikelbibliotheken
oder Physik-Engines verwendet.

---

## 11. Dateien

```
ha4/ha3/
├── index.html    HTML, CSS und Import Map (kein Inline-JavaScript)
├── sketch.js     p5.js-konformer Einstiegspunkt: nur setup() und draw()
├── js/           ES-Module der Szene
├── README.md     diese Dokumentation
└── scene.blend   optionale Blender-Datei, wird von index.html nicht geladen
```

`scene.blend` ist nicht Teil der Laufzeit. Wenn sie nicht zur Abgabe gehört,
kann sie beim Zippen weggelassen werden.
