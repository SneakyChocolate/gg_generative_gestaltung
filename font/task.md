# Task: Animated / interactive font scene

University homework (Generative Gestaltung). Time budget: **1 week**. Professor has high expectations and grades on technical complexity, design idea and amount of work.

## The task

Create a scene in which a **font (a word) is animated or interactable**, with **forces acting on it**.

## Minimum (this is NOT full points)

- A word made of particles that flee from the cursor.

This is the baseline everybody hands in. It earns roughly the lowest passing score.

## What earns full points

| Criterion | What the professor expects |
|---|---|
| **Forces** | Not just one. Several forces, applied one after another or added together (e.g. gravity + wind + spring back to shape + mouse + collision). |
| **Environment** | The word stands *in* a scene that feels natural (ground, sky, weather, room, light), not a word floating on a blank background. |
| **Color** | Colors / gradients that make sense and **visualize the forces** (e.g. speed, temperature, pressure, stress), not only decorative texture. |
| **Rendering** | Particles are acceptable but primitive. More advanced = 3D meshes, soft bodies, geometry deformed by forces. |
| **Meaning of the word** | The word is personal or connected to what we implement. Not a random word. |
| **Coherence** | Idea, word, forces, colors and environment all interlock. Everything refers to everything else. |
| **Amount of work** | More than "wrote a word". Visible effort across several systems. |

## Constraints

- We must be able to **write and explain every line ourselves**. No complex formulas we can't derive; no generic AI-looking code.
- Simple code, but with **deliberate design decisions** we can defend.
- Must be doable in **~1 week**. Scope carefully.

## Free to decide

- Tech: p5.js (2D / WEBGL), plain JS, any library that fits.
- Rendering: particles, 3D meshes, soft-body grid, vector outlines, hybrid.
- The word, the font look, the environment, the forces, the palette.
- Interaction (mouse, keys, time of day, ...).

## Fixed

- Deliverable runs in the browser (like `../has`).
- Several forces, an environment, force-driven color, a meaningful word.

## Existing drafts in this folder

- `particles/` - word "PRESSURE", spring + shock + gas threshold (2D particles)
- `entropy/` - word "ENTROPY", spring + drag + noise flow + shock, "temperature"
- `droplets/` - word "REGEN", droplets on a fogged window merge and run down (idea E)
- `3d-mesh/` - word "SCHWAMM", voxel mass-spring soft body, sponge dropped on it (3D)
- `../has/` - older rain / cloud / terrain / autumn sketch (reusable environment code)

## Ideas

See [ideas/README.md](ideas/README.md).

## notes

we should use some sprites or textures and images to improve the environment. 
