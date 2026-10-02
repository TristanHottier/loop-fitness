---
name: Notion Style UI
description: Design tokens, layout rules, and the banned patterns for UI implementation.
---

# Design Rules

Reference: the Notion website and app. Calm, flat, document-like.

## Do
1. Use the system sans font stack: `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`. Use tabular numerals for all numbers and timers.
2. Use Sentence case everywhere.
3. Page titles: ~28px, bold. Body: 16px.
4. Surfaces: Flat, 1px borders, 4-6px border radius, generous whitespace, left-aligned content. Almost no shadows.
5. Touch targets: Minimum 48px.
6. Icons: Simple outline icons (Lucide) or none at all.
7. **Dark Tokens (Default)**:
   - background: `#191919`
   - surface: `#202020`
   - hover: `#2A2A2A`
   - border: `#2F2F2F`
   - text: `#EBEBEB`
   - secondary text: `#9B9B9B`
   - accent: `#529CCA`
8. **Light Tokens**:
   - background: `#FFFFFF`
   - surface: `#F7F6F3`
   - hover: `#EFEEEC`
   - border: `#E9E9E7`
   - text: `#37352F`
   - secondary text: `#787774`
   - accent: `#2383E2`

## Never
1. No em dashes (—) or en dashes (–) in UI text. No center dots (·) as separators; use commas or line breaks.
2. No monospace fonts in the UI.
3. No large all-caps titles or `text-transform: uppercase`.
4. No gradients, glows, sparkle icons, neon colours, glassmorphism, heavy shadows, or emoji overload.
5. No marketing-style copy or exclamation marks.
