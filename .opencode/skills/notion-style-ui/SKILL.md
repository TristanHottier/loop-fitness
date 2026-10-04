---
name: Notion Style UI
description: Design tokens, layout rules, and the banned patterns for UI implementation.
---

# Design Rules

Reference: the Notion website and app, with a richer finish. Calm, flat, document-like, with one muted hue per workout. Direction A from `docs/design-v2.md` is the chosen direction. All values live in `app/src/styles/tokens.css`.

## Do
1. Fonts are self-hosted: Figtree for display (titles, big numerals) and Inter for body and data. Tabular numerals for all numbers and timers.
2. Use Sentence case everywhere.
3. Page titles: 28 to 32 px, bold, in Figtree. Big numerals: 40 to 56 px. Body: 16 px in Inter.
4. Surfaces: flat, 1 px borders, 4 to 6 px border radius, generous whitespace, left-aligned content. Soft shadow only on bottom sheets and the rest timer bar.
5. Touch targets: minimum 48 px.
6. Icons: one custom outline set, 1.75 stroke, round caps, for muscle groups and equipment.
7. **Dark Tokens (Default)**:
   - background: `#191919`
   - panel: `#1F1F1F`
   - sheet: `#262626`
   - border: `#2F2F2F`
   - text: `#EBEBEB`
   - secondary text: `#9B9B9B`
   - accent: `#529CCA`
8. **Light Tokens**:
   - background: `#FFFFFF`
   - panel: `#F7F6F3`
   - sheet: `#FFFFFF`
   - border: `#E9E9E7`
   - text: `#37352F`
   - secondary text: `#787774`
   - accent: `#2383E2`
9. **Per-workout hue** (used as a tag, a cover tint, and a chart line):
   - Dark: Pull `#529CCA`, Push `#5E9E7A`, Shoulders and arms `#C29A5B`.
   - Light: Pull `#2383E2`, Push `#2E7D5B`, Shoulders and arms `#A66A2E`.
10. **Muscle-group colors** (shared, desaturated, used in the muscle map and exercise tags):
    - chest `#C97B6E`, front delts `#C79A5B`, side delts `#B8A24A`, rear delts `#5E9E7A`, biceps `#529CCA`, brachialis `#6E7FC0`, triceps `#7FA85E`, lats `#5FA8A8`, mid back `#8A7FB0`, upper back `#7A8A9A`.
11. Signature motion: the logo infinity line draws itself on the splash screen and on the session complete screen. Everything else moves only in response to a tap. Respect reduced motion.

## Never
1. No em dashes (—) or en dashes (–) in UI text. No center dots (·) as separators; use commas or line breaks.
2. No monospace fonts in the UI.
3. No large all-caps titles or `text-transform: uppercase`.
4. No gradients, glows, sparkle icons, neon colours, glassmorphism, heavy shadows, or emoji overload.
5. No marketing-style copy or exclamation marks.
