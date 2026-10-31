# B: Sponge

**Word:** SCHWAMM. Letters are a soft foam body, a sponge/hand squeezes and soaks them.

## Concept

Extends the existing `../3d-mesh` draft (voxel mass-spring grid). The word is a real soft object in a sink/bath scene. Water poured on it is absorbed and makes it heavy and dark.

## Scene

- 3D: counter top, tiled wall, a water tap, soft light.
- Word lies / stands on the counter.
- Optional: a hard sponge block you drop (already in the draft).

## Forces (summed)

1. Gravity.
2. Spring forces between voxel nodes (stiffness).
3. Memory - slow pull back to original shape.
4. Collision with counter and the dropped block.
5. Water weight - absorbed water adds mass, so letters sag.
6. Squeeze - mouse press compresses and pushes water out.

## Color = force

- Stress: color of each voxel by spring compression (blue relaxed, red squeezed).
- Water content: dry yellow foam to wet dark.
- Drips: blue particles when squeezed.

## Why it scores

- True 3D mesh and soft body, the advanced option from the task.
- Word *is* the object, strong meaning.

## Risks

- Soft body stability (substeps, damping). Draft already handles it.
- Environment is the weaker part, needs effort so it is not just a box scene.

## Minimum viable cut

Draft + counter scene + stress color + one absorb mechanic.
