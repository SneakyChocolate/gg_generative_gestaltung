# Kerze „ZEIT" v2 – Überarbeitungsplan

> Stand: Plan, noch nicht umgesetzt. Nach Freigabe wird jeder Task wie in v1 per TDD umgesetzt (Subagent pro Task, Review danach).

**Ziel:** Die gemeldeten Probleme beheben, und zwar an der Ursache. Abgebrochene Teile bleiben Teil des Buchstaben-Meshes und fallen dort. Es entstehen keine neuen Objekte. Alle Hitze kommt aus dem echten Abstand jedes Vertex zur Flamme. Tropfen sind selten, verhalten sich als Pfütze wie eine Scheibe und landen auch auf der Kerze.

**Entscheidungen (User, 2026-11-07):**
- ca. **10 Tropfen pro Buchstabe** über das ganze Abbrennen (heute ~240)
- **cannon-es entfernen**, es bleibt eine eigene Physik. Hinweis: PROMPT.md verlangt eigentlich umschaltbare Physik. Der User hat bewusst entschieden.
- abgebrochene Teile fallen **nach unten mit leichtem Kippen** zur Seite ohne Stütze

---

## Probleme → Ursache → Lösung

| # | Problem (User) | Ursache im Code | Lösung |
|---|---|---|---|
| 1 | Fallende Tropfen verschmelzen schon in der Luft mit Pfützen | Pfütze ist logisch eine Kugel (`drops.js:127-129`), gezeichnet aber als flache, eingesunkene Kugel | Pfütze wird logisch eine **Scheibe** (Mitte, Radius R, Höhe H). Ein Tropfen verschmilzt erst, wenn er die Oberseite der Scheibe berührt. Gezeichnet wird eine Kugelkappe, die genau R und H trifft. |
| 2 | Viel zu viele Tropfen | Spawn alle `DROP_INTERVAL` = 0.5 s (`drops.js:53`) | Spawn an den Brennfortschritt gekoppelt: `DROPS_PER_LETTER = 10` Überläufe pro Buchstabe, immer an der **tiefsten Stelle des Muldenrands**. So laufen sie dieselbe Bahn und mergen sichtbar. |
| 3a | Brocken springen nach vorne, „Explosion" | Startgeschwindigkeit z 0.3–0.6, y 0.4 und zufälliger Drall (`physics/own.js:24-25`, `cannon.js:27-28`). Bei cannon schieben sich überlappende Hüllen zusätzlich auseinander. | Keine Startgeschwindigkeit, kein Drall. Das Teil fällt nur durch Schwerkraft und kippt leicht um seine letzte Stützkante. |
| 3b | Teile schweben in der Luft | Bruch erst, wenn die hängende Säule **dünn** ist (`breakage.js:33`), nicht, wenn die Stütze weg ist | **Stütztest per Flood-Fill:** Wachszellen, die nicht mehr mit dem Tisch verbunden sind, fallen sofort. Überhänge brechen zusätzlich nach dem Hebelgesetz (Gewicht × Hebel gegen Haltekraft × Hitzeschwächung). |
| 3c | Abgebrochene Teile schmelzen nicht | Brocken sind eigene Meshes ohne Hitze-Update. Die Hitze rechnet mit Ruhepositionen (`heat.js:36-39`). | Teile bleiben im Buchstaben-Mesh. Die Hitze nutzt die **aktuelle** Vertexposition (inkl. Fall und Kippen) und den echten 3D-Abstand zur Flamme. |
| 4 | Neue Objekte (Hüllen) entstehen in den Buchstaben und kollidieren | `ConvexGeometry` und `addChunk` in `main.js` | Fällt weg. Beim Bruch werden die Vertices der Bruchfläche **dupliziert** (Reserveplatz im Buffer). Teil und Rest sind getrennt, bleiben aber ein Mesh. |
| 5 | Tropfen ignorieren die Kerze | Tropfen kennen nur `TABLE_Y` | **Höhenfeld pro Buchstabe** (XZ-Raster, höchster Wachspunkt pro Zelle, jeden Frame aus dem Mesh). Fallende Tropfen und fallende Teile landen auf Wachs darunter (z. B. unterer Balken von E) oder auf dem Tisch. |

---

## Neues Modell, kurz erklärt

**Positionen in drei Stufen pro Vertex:**
1. `rest`: Ausgangsform, ändert sich nie
2. `base`: `rest` nach Fall und Kippen des Teils, zu dem der Vertex gehört (Standteil: `base = rest`)
3. `position` (gezeichnet): `base` nach Abbrennen (Deckel), Absacken und Färbung durch Hitze

Hitze, Abbrennen und Absacken lesen nur `base`. Darum schmilzt ein heruntergefallenes Stück nahe der Flamme ganz normal weiter.

**Wärmequelle:** die Flammenmitte (Docht + `FLAME_HEAT_OFFSET` nach oben). Abstand in 3D von `base` zur Flamme. `T = clamp(1 − d / HEAT_RADIUS)`.

**Stütze und Bruch** (alle `SUPPORT_CHECK_SECONDS`, nur solange der Buchstabe brennt):
- Zelle lebt = gefüllt, nicht abgebrannt (Deckel über der Zellunterkante) und nicht schon gefallen.
- Flood-Fill (4er-Nachbarn) von lebenden Zellen der untersten Reihe aus → getragen.
- Lebende, nicht getragene Zellen → Zusammenhangskomponenten → jede fällt als **ein** Teil (statt 10-cm-Streifen wie heute).
- Getragene Überhänge (Zellen ohne Wachs direkt darunter, verbunden mit einer stehenden Säule): pro Überhang-Komponente
  `Moment = Zellen · Hebel` (Hebel = mittlerer waagrechter Abstand zur Ansatzkante, in Zellen)
  `Halt = Ansatzzellen · (1 − HEAT_WEAKENING · T_Ansatz)`
  Bruch bei `Moment > CANTILEVER_STRENGTH · Halt`. Damit fließen Hitze und Gewicht in die Regel ein.

**Teil fällt (in `pieces.js`):**
- Beim Bruch: Dreiecke des Teils bekommen eigene Kopien aller Vertices, die sie mit dem Rest teilen (Reserveplatz `SPARE_VERTEX_FRACTION` im Buffer, Index zeigt auf die Kopien).
- Zustand: Drehpunkt = untere Ecke der Ansatzkante, Kipprichtung = weg von der Stütze, Fallweg `s`, Geschwindigkeit `v`.
- Pro Frame: `v += g·dt`, `s += v·dt`, Kippwinkel `θ = TIP_MAX_ANGLE · min(1, s / TIP_DISTANCE)`. `base` = `rest` um θ gedreht (z-Achse durch den Drehpunkt), dann um `s` nach unten verschoben.
- Landen: tiefster `base`-Punkt des Teils ≤ Höhenfeld darunter (ohne das Teil selbst) oder `TABLE_Y` → `v = 0`, liegt. Kein waagrechter Schub.

**Tropfen:**
- Überlauf: Pro Buchstabe zählt der Brennfortschritt `p` (0..1). Bei `p ≥ k / DROPS_PER_LETTER` (mit kleinem Zufallsversatz) entsteht Tropfen k. Ort: der Vertex auf der Vorderseite (`normal.z > 0.7`) am Muldenrand (gedeckelt, `T` im Band) mit der **tiefsten** gedeckelten Höhe.
- Gleiten wie bisher bis zum Boden der eigenen Säule, dann freier Fall.
- Fallen: landet auf `max(Höhenfeld(x,z), TABLE_Y)` und wird dort zur Pfütze (Scheibe mit `baseY` = Landehöhe).
- Pfütze: Volumen V, feste Höhe `PUDDLE_HEIGHT`, Radius `R = √(V / (π · H))`.
  - Tropfen + Pfütze verschmelzen, wenn `|xz − Mitte| < R + r` **und** `y − r ≤ baseY + H`.
  - Pfütze + Pfütze (gleiche `baseY`) verschmelzen bei `|xz₁ − xz₂| < R₁ + R₂`. Volumen addiert sich, die Mitte wird flächengewichtet.
  - Tropfen + Tropfen in der Luft: Kugelregel wie bisher.
- Pfütze auf der Kerze: Brennt die Fläche darunter weg (Höhenfeld < `baseY − ε`), fällt die Pfütze als Tropfen weiter.
- Zeichnen einer Pfütze als Kugelkappe: Kugelradius `S = (R² + H²) / (2H)`, Kugelmitte `y = baseY + H − S`. Die sichtbare Kappe hat damit genau Radius R und Höhe H.

**Tropfen ↔ Kerze (Zusatz User, 2026-11-07):**
- **Massenverlust beim Laufen:** Ein gleitender Tropfen verliert pro Wegstrecke `ds` das Volumen `dV = TRAIL_LOSS · V · ds`, wird also kleiner. Fällt sein Radius unter `DROP_STUCK_R`, bleibt der Rest ganz an der Kerze hängen und der Tropfen verschwindet (erstarrt).
- **Masse bleibt an der Kerze:** Es gibt keine neuen Objekte. Jeder Vertex hat eine Schichtdicke `deposit`. Das verlorene Volumen verteilt sich auf die Vertices im Spurband (Breite 2r, Länge ds): `Dicke += dV / (2r · ds)`, mit weichem Abfall zum Rand. Die gezeichnete Position = Hitze-Position + `deposit · Ruhe-Normale`. Es entsteht eine echte Wachswulst im Mesh. Erstarrtes Wachs ist kalt gefärbt. Wird die Stelle wieder heiß (`T > DEPOSIT_MELT_T`), schmilzt die Schicht langsam ab.
- **Tropfenform:** Gleitende Tropfen sind keine Kugel. Sie bestehen aus einem Kopf-Ball (unten, voller Radius) und `TAIL_BALLS` kleiner werdenden Bällen nach oben (Schweif). Die Mitten liegen leicht in der Oberfläche, so dass nur die halbe Linse sichtbar ist. Fallende Tropfen sind leicht senkrecht gestreckt (2 Bälle). Die Metaballs verschmelzen das zur Tropfenform. Logisch zählt nur das Volumen am Kopf.

---

## Dateien

| Datei | Änderung |
|---|---|
| `physics/cannon.js` | löschen |
| `physics/own.js` | ersetzt durch `physics.js`: Schwerkraft-Schritt plus Landen auf einer Höhe aus einer Callback-Funktion (für Tropfen und Teile) |
| `surface.js` | **neu**: Höhenfeld pro Buchstabe (`buildSurface(letter)`, `heightAt(surface, x, z)`) aus den stehenden und gelandeten Vertices |
| `pieces.js` | **neu**: Vertex-Split beim Bruch, Fall mit Kippen, Landen, schreibt `base` |
| `breakage.js` | neu geschrieben: Stütz-Flood-Fill + Hebelregel → Liste von Zellkomponenten. Kein `cutOut` mehr. |
| `heat.js` | `updateLetter` liest `base`, Abstand zur Flammenmitte in 3D, Ergebnis in `position` |
| `model.js` | Buffer mit Reserveplatz, Felder `base`, `vertexCount`, `capacity` |
| `drops.js` | Spawn nach Fortschritt am Überlaufpunkt, Pfützen als Scheiben, Landen auf dem Höhenfeld, Kappen-Rendering |
| `main.js` | ohne `dropChunk`/`ConvexGeometry`. Reihenfolge pro Frame: Teile bewegen → Höhenfeld → Hitze → Stütztest → Tropfen |
| `config.js` | entfernt: `PHYSICS_BACKEND`, `MAX_CHUNKS`, `MIN_CHUNK_SIZE`, `DROP_INTERVAL`, `PUDDLE_SPREAD`, `PUDDLE_SINK`, `BREAK_THICKNESS`, `WEIGHT_LEVERAGE`. Neu: `DROPS_PER_LETTER = 10`, `PUDDLE_HEIGHT`, `SPARE_VERTEX_FRACTION`, `SUPPORT_CHECK_SECONDS`, `CANTILEVER_STRENGTH`, `TIP_MAX_ANGLE`, `TIP_DISTANCE`, `FLAME_HEAT_OFFSET`, `SURFACE_CELL` |
| `index.html`, `verify.html` | cannon-Eintrag aus der importmap entfernen |
| `README.md`, Spec | an das neue Modell anpassen |

---

## Tasks (Reihenfolge, je TDD, je ein Commit)

1. **cannon und Brocken-Objekte entfernen.** cannon.js, importmap-Eintrag, `PHYSICS_BACKEND`, `dropChunk`/`ConvexGeometry` und die Chunk-Tests raus. `own.js` → `physics.js` mit `step(body, dt, groundY)`.
   *Test:* Tropfen fällt auf `groundY` und liegt dort, ohne seitliche Bewegung.
2. **Reserveplatz und `base` in model.js; heat.js liest `base`, Hitzequelle = Flammenmitte.**
   *Test:* Regression aller bisherigen Heat- und Model-Tests. Ein manuell um 0.3 nach unten versetzter `base`-Vertex nahe der Flamme ist heißer als in Ruhelage über der Flamme.
3. **surface.js Höhenfeld.**
   *Test:* Für E liefert `heightAt` über dem unteren Balken ≈ Balkenoberkante, neben dem Buchstaben −∞ (dann gilt `TABLE_Y`).
4. **breakage.js Stütztest + Hebelregel.**
   *Tests:* Synthetisches Raster: Balken ohne Stütze → eine Komponente. T-Balken mit wegbrennendem Stamm → beide Arme fallen. I → nie eine Komponente. Echte Buchstaben über ganzes Abbrennen: E und T brechen, I nicht, und **zu keinem Zeitpunkt** gibt es lebende, nicht getragene Zellen, die nicht als fallend markiert sind (keine Schwebeteile).
5. **pieces.js Split + Fall + Kippen + Landen.**
   *Tests:* Nach dem Split teilen Teil und Rest keinen Index mehr. Das Teil landet mit tiefstem Punkt ≈ Untergrund (±0.01). Die waagrechte Verschiebung des Schwerpunkts ist ≤ der Verschiebung durch Kippen allein (kein Schub nach vorne). Ein gelandetes Teil in Flammennähe hat Temperatur > 0 und sackt ab.
6. **Tropfen nach Brennfortschritt am Überlaufpunkt.**
   *Test:* Ganzes Abbrennen eines Buchstabens erzeugt `DROPS_PER_LETTER ± 1` Tropfen. Aufeinanderfolgende Spawnpunkte liegen nah beieinander (< 0.1).
7. **Pfützen als Scheiben + Merge-Regeln + Kappen-Rendering.**
   *Tests:* Tropfen 0.2 über Pfützenmitte → kein Merge. Tropfen berührt Oberseite → Merge, Volumen bleibt. Zwei Pfützen mit Abstand < R₁+R₂ → eine. Kappenformel: Höhe = H, Radius = R.
7b. **Massenverlust + Wachsspur im Mesh + Tropfenform.** `deposit` pro Vertex in model/heat, Spur-Verteilung in drops.js, Kopf+Schweif-Rendering.
   *Tests:* Volumen Tropfen + abgelegtes Spurvolumen bleibt (±5 %). Ein Tropfen auf langer Bahn bleibt stecken (Radius < `DROP_STUCK_R` → entfernt). Vertices entlang der Bahn haben `deposit > 0`, daneben 0. Heiße Vertices verlieren `deposit`.
8. **Tropfen landen auf der Kerze.**
   *Test:* Tropfen über dem unteren E-Balken landet auf Balkenhöhe, nicht auf dem Tisch. Brennt der Balken darunter weg, fällt er weiter.
9. **main.js verdrahten, Sim-Screenshots bei 15/60/130 s, FPS-Messung (CPU-Zeit pro Frame).**
   *Prüfung:* keine Schwebeteile, keine Sprünge nach vorne, gefallene Teile schmelzen, ~10 Tropfen/Buchstabe, Pfützen flach, Tropfen auf Balken sichtbar.
10. **README + Spec aktualisieren**, dann finaler Gesamt-Review.

---

## Risiken / offene Punkte

- **Offene Bruchflächen:** Teil und Stumpf sind Schalen und an der Bruchstelle offen (das ist schon heute so). Bleibt vorerst. Bei Bedarf später eine Deckfläche aus den Randkanten.
- **Zackige Bruchkante:** Die Zuordnung der Dreiecke zu Zellen über den Schwerpunkt bleibt, gröbstenfalls 0.05 Zacken (Tessellierungsgröße).
- **Kosten:** Höhenfeld jeden Frame O(Vertices), ~20k → < 1 ms. Flood-Fill nur alle `SUPPORT_CHECK_SECONDS` auf ~100 Zellen pro Buchstabe.
- **Tropfen über Buchstabengrenzen:** Jedes Metaball-Feld gehört weiter zu einem Buchstaben. Pfützen benachbarter Buchstaben überlappen, verschmelzen aber nicht.
- **PROMPT-Abweichung:** keine umschaltbare Physik-Bibliothek mehr (User-Entscheidung). Das gehört in die README, damit es bei der Abgabe erklärt werden kann.
