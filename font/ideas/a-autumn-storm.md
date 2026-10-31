# A: Autumn storm

**Word:** HERBST (autumn). Alternative: a personal word carved as a sign.

## Concept

Big letters stand on the terrain from `../../has` (clouds, rain, autumn leaves). Weather acts on them: wind bends and tears off leaves, rain hits and runs down, mouse is a gust. The letters are built from leaves/particles that hang on a wooden/stone 3D slab.

## Scene

- Terrain + sky + clouds + rain from `has` (already exists).
- Letters: extruded 3D blocks (or a voxel grid like `3d-mesh`) standing on the ground.
- Leaf particles cover the front face and detach under wind.

## Forces (summed)

1. Gravity - leaves fall once detached.
2. Wind - from the cloud noise field (same `noise` that makes the clouds, so sky and force match).
3. Spring - attached leaves pull back to their letter position.
4. Rain impact - drops push leaves down and wet them.
5. Mouse gust - radial push plus swirl.
6. Drag - air resistance, stops leaves from exploding.

## Color = force

- Leaf color: dry orange/yellow to wet dark brown (wetness from rain hits).
- Speed tint: fast leaves lighter / red-hot, slow ones desaturated.
- Wind field shown as faint streaks in the clouds' color.

## Why it scores

- Environment is real and already half built.
- Forces share one noise field with the visuals (everything connects).
- Word, season and weather mean the same thing.

## Risks

- Merging `has` rendering with 3D letters. Mitigation: keep letters 2.5D (layers with parallax) if WEBGL gets heavy.
- `has` performance TODOs (rain chunks).

## Minimum viable cut

2D scene, particle letters, forces 1-5, wetness color. 3D is the bonus.
