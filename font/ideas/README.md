# Ideas overview

Goal is not decided yet. This page compares the candidates so we can pick one (or merge two) early. Task and grading: [../task.md](../task.md).

## Candidates

| # | Idea | Word | Rendering | Environment | Reuses |
|---|---|---|---|---|---|
| A | [Autumn storm](a-autumn-storm.md) | HERBST | 3D extruded letters + leaf particles | rain, clouds, terrain, wind | `../../has`, `3d-mesh` |
| B | [Sponge](b-sponge.md) | SCHWAMM | voxel soft body (3D) | kitchen sink / bath, water | `3d-mesh` |
| C | [Ice melt](c-ice-melt.md) | EIS | particles + mesh, phase change | sunrise over a frozen lake | `entropy` |
| D | [Entropy](d-entropy.md) | ENTROPY | particles | lab / abstract | `entropy`, `particles` |
| E | [Window droplets](e-window-droplets.md) | REGEN / personal | merging droplets (circles, bonus metaballs) | rainy window, night city | `../../has` rain + chunks |

## Comparison

| | Forces | Environment | Color = force | Risk in 1 week | Fits "meaning" |
|---|---|---|---|---|---|
| A | high (wind, gravity, rain hits, spring, mouse) | strong, already half built | speed / wetness / wind | medium (3D letters + existing code merge) | good if personal |
| B | medium-high (gravity, spring, collision, absorption) | medium (needs a scene) | water content / stress | medium (soft body stability) | strong, word *is* the object |
| C | high (heat, gravity, drip, spring, wind) | strong (light + sky) | temperature gradient | low-medium | strong, word *is* the phenomenon |
| D | medium | weak | temperature | low | abstract |
| E | high (gravity, adhesion, cohesion, wind, mouse) | strong (window + city) | speed / size / refraction | medium (neighbor grid, tuning) | strong, matches professor's droplet topic |

## Recommendation (to discuss)

**C or A.** Both have a natural environment and many forces that stack. C is the safest for 1 week, A is the most impressive but is the biggest merge. D is the safest fallback but is too close to the "minimum".

Merge option: **C + A parts** (ice letters standing in the autumn/rain world from `has`, the weather melts or freezes them).

## Shared building blocks (any idea)

- Word to points: draw text into `createGraphics`, sample pixels (already in the drafts).
- Force list as plain functions `force(p) -> vector`, summed per particle. Easy to explain, easy to toggle with keys.
- Force debug view: key to show each force as colored arrows or tint. Good for the presentation.
- Palette defined once at the top, gradients via `lerpColor` only (no custom color math).

## Week plan (rough, same for all)

| Day | Goal |
|---|---|
| 1 | Pick idea and word. Static scene + word on screen. |
| 2 | Force 1 + 2 (spring back, gravity). Color from speed. |
| 3 | Force 3 + 4 (wind / noise, mouse). Force toggle keys. |
| 4 | Environment polish (sky, ground, light). |
| 5 | Special mechanic of the idea (melt / absorb / storm). |
| 6 | Color tuning, performance, cleanup so we can explain each part. |
| 7 | Buffer, write-up, rehearse explanation. |

## Open questions

- Which word is personal to us?
- 2D with fake depth or real 3D (WEBGL)?
- Do we show a force legend on screen (professor sees what is happening)?
