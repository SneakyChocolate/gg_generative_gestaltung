# E: Window droplets

**Word:** REGEN / TROPFEN, or a personal word. Alternative: a word whose meaning is merging (ZUSAMMEN).

## Concept

The word is written in droplets on a rainy window pane. Droplets merge when they touch, get heavy, and run down, so the word slowly melts and smears into trails. Ties directly to the fluid-droplet-merge topic from the last homework and to the rain code in `../../has` (chunk grid for neighbor lookup already exists).

## Scene

- Window glass in front of a blurred night city (colored bokeh lights, gradient sky).
- Fog / condensation layer: the word is wiped into it or formed by droplets.
- Rain adds new small droplets at random.

## Core mechanic: merging (simple version)

Each droplet has position, radius, velocity. Two droplets merge when `dist < r1 + r2`:

- area is conserved: `r = sqrt(r1*r1 + r2*r2)`
- position is the mass-weighted average (mass = r²)
- velocity by momentum: `(m1*v1 + m2*v2) / (m1 + m2)`

Neighbor search with a grid like `has/chunks.js`, so it stays fast with a few thousand droplets.

## Forces (summed)

1. Gravity, pulls down.
2. Adhesion / static friction: a droplet only moves if its mass is above a threshold (small ones stick, so the word stays readable until merging makes them big).
3. Surface tension / cohesion: droplets near each other attract slightly before merging.
4. Wind: gust pushes droplets sideways (noise field).
5. Mouse: wipe (removes fog and droplets) or breath (adds fog + tiny droplets).
6. Drag, so runners don't accelerate forever.

## Color = force

- Droplet tint by speed (still = clear, fast = brighter / cooler).
- Size shown by refraction strength: big droplets show the city lights flipped and magnified (draw the background scaled and inverted inside the circle).
- Trails colored by how much water passed.
- Fog opacity = how much of the word is still intact.

## Rendering options

- Minimum: circles with highlight + refracted background, 2D.
- Bonus: metaballs. Sum of `r² / d²` per pixel on a low-res grid, threshold gives the blobs that visibly bulge together before merging. Explainable in 3 lines, but costs per-pixel work, so low resolution or shader.

## Why it scores

- Merging is a real fluid phenomenon and the professor asked for it.
- Environment (window + night city) and word (rain / droplets) mean the same thing.
- Forces create a story: word is stable, then rain and gravity destroy it, mouse can restore it.

## Risks

- Many droplets: needs the neighbor grid (exists in `has`).
- Refraction look: start with a flipped scaled copy, no real optics.
- Readability of the word: threshold in force 2 and starting droplet size need tuning.

## Minimum viable cut

Droplets from word pixels, merge rule, gravity + adhesion threshold, rain, mouse wipe, speed tint. Metaballs and refraction are the bonus.
