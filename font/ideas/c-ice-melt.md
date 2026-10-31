# C: Ice melt

**Word:** EIS (ice). Letters of ice standing on a frozen lake, the sun rises and melts them.

## Concept

Phase change as the main story: solid letters turn to drops, then pool as water, and freeze again at night. Time of day drives temperature. Builds on the `../entropy` draft (temperature, spring, drag, noise).

## Scene

- Frozen lake at dawn, gradient sky (dark blue to orange), sun position tied to time.
- Letters stand on the ice with a faint reflection.
- Water pool collects at the base when melted.

## Forces (summed)

1. Spring - solid ice holds the shape (spring strength falls with temperature).
2. Gravity - drops fall once the spring breaks.
3. Heat - sun warms letters from the side facing it, melt starts there.
4. Wind - noise field blows drops sideways.
5. Mouse - breath / touch, local heating (hold to melt, like a warm hand).
6. Drag.

## Color = force

- Temperature gradient on the letters: cold cyan, white, warm yellow, melting orange-tinted.
- Drops colored by speed.
- Sky gradient shows the same time that drives the heat, so the scene and the force match.

## Why it scores

- Many forces that visibly change over time, one clear story.
- Word, environment and forces mean the same thing.
- Color is the temperature, directly visualizes a force.

## Risks

- Few. Water pool is the hardest part: simple version is a growing flat ellipse, no fluid sim.

## Minimum viable cut

Particles, temperature field, spring that weakens, gravity + wind, dawn sky gradient. Mesh version is the bonus (letters as extruded blocks that shrink).
