# Loop Fitness, visual style v2

Two directions. Pick one (or blend them). Phase 2 applies the chosen direction to the real app.
Nothing here changes features or data. It is a restyle only.

Hard rules that stay in both directions:
- No em dashes or en dashes, no middle dots, no monospace, no large all-caps titles, no uppercase text, anywhere in the UI.
- Notion stays the structural reference: pages, toggles, property rows, tags. Dark first, light supported.
- Must not look AI generated. Banned: cream background with serif headings and a terracotta accent, near-black with a single acid accent, purple or neon gradients, a grid of identical rounded cards, glassmorphism, sparkle icons, emoji, confetti, exclamation marks.

Shared notes
- The logo is an infinity line on a dark tile. I could not view the PNG (no image input in this model), so the "infinity line" motif below is drawn from the brief and your task text. If the real mark differs, the cover band and the signature motion need a quick recheck.
- Muscle-group colors are a shared semantic set used in both directions (the muscle map and exercise tags). They are calm and desaturated so the map reads as a diagram, not a rainbow.
- Fonts are self-hosted in Phase 2. The static previews load them from a CDN so you see the real type on the phone.

Muscle-group colors (shared, both directions)
Used at about 0.85 opacity in the muscle map and as tag tints. All desaturated.

| Group | Hex |
|---|---|
| chest | #C97B6E |
| front_delts | #C79A5B |
| side_delts | #B8A24A |
| rear_delts | #5E9E7A |
| biceps | #529CCA |
| brachialis | #6E7FC0 |
| triceps | #7FA85E |
| lats | #5FA8A8 |
| mid_back | #8A7FB0 |
| upper_back | #7A8A9A |

---

# Direction A: Notion with a richer finish

A calm, document-like base with one muted hue per workout. The richness comes from type contrast, a cover band, and a single signature motion (the infinity line drawing itself). Surfaces stay flat; only sheets and the timer bar get a soft shadow.

## Color tokens

Dark (default)
| Token | Hex | Use |
|---|---|---|
| bg | #191919 | page |
| panel | #1F1F1F | cards, property rows |
| sheet | #262626 | bottom sheets, timer bar |
| border | #2F2F2F | 1px dividers |
| text | #EBEBEB | primary text |
| text-2 | #9B9B9B | secondary text |
| accent | #529CCA | actions, active tab, chart line |

Per-workout hue (desaturated, Notion tag colors). Used as a tag, a cover tint, and a chart line.
| Workout | Hex |
|---|---|
| Pull | #529CCA |
| Push | #5E9E7A |
| Shoulders and arms | #C29A5B |

Light (mirror)
| Token | Hex |
|---|---|
| bg | #FFFFFF |
| panel | #F7F6F3 |
| sheet | #FFFFFF |
| border | #E9E9E7 |
| text | #37352F |
| text-2 | #787774 |
| accent | #2383E2 |

Per-workout hue on light (darker for contrast): Pull #2383E2, Push #2E7D5B, Shoulders and arms #A66A2E.

## Type
- Display face: Figtree (geometric, rounded terminals). Titles 28 to 32, bold. Big numerals 40 to 56.
- Body and data: Inter, tabular figures. Body 16.
- Sentence case everywhere. Size and weight do the contrast, not color.

## Layout concept
- Workout pages: a cover band about 120px tall, built from the logo infinity line in the workout hue at low opacity. Below it, an icon, the title, and property rows (days, duration, equipment tags).
- Today: a week strip (Mon to Sun) with the three training days marked and done days as filled rings, a thin session progress line, the next workout as a page link, and weight entry as a property row.
- Session: each exercise is a toggle with its set rows inside. The active exercise gets a colored left border. Set rows have a checkbox that draws its check stroke when tapped, reps and band as tappable fields, 48px minimum height. A thin progress line at the top shows sets done. A small "new best" tag appears when reps or band beat the last session.
- Rest timer: bottom bar with a ring that depletes around large tabular numerals, in the workout hue. Minus 15, plus 15 and skip as text buttons. Vibration at the end.
- Band picker: bottom sheet, the ladder as steps with the lb value, tube and loop distinguished by tag color, last used band marked.
- Progress: charts in one hue, a soft single-hue area fade, light gridlines, a direct label on the latest point, small markers where the band changed, delta tags such as +0.4 cm. A goal line is allowed.
- Icons: one custom outline set, 1.75 stroke, round caps to echo the logo, for muscle groups and equipment.
- Signature motion: the infinity line draws itself on the splash screen and on the session complete screen (sets, total reps, new bests as property rows). Everything else moves only in response to a tap. Respect reduced motion.
- Empty states use the infinity line and one sentence saying what to do next.

## Wireframes

Today (dark)
```
+------------------------------------------+
| Today                                     |
| Your next workout and quick entries.      |
|                                          |
|  M   T   W   T   F   S   S              |
|  (o) ( ) (o) ( ) (o) ( ) ( )   <- rings  |
|  Pull        Push      Shoulders         |
|                                          |
|  Session progress                        |
|  [================----]  5 of 7 sets    |
|                                          |
|  Next workout                            |
|  +------------------------------------+  |
|  | Pull, Monday          [Start]      |  |
|  +------------------------------------+  |
|                                          |
|  Weight (today)                          |
|  +------------------------------------+  |
|  | 82.4 kg        [ +0.2 ] [ -0.2 ]   |  |
|  +------------------------------------+  |
+------------------------------------------+
| Today  Plan  Progress  Settings  Nutrition|
+------------------------------------------+
```

Workout session (dark, Pull)
```
+------------------------------------------+
| Pull, Monday                 [Finish]    |
| [==================----]  5 of 7 sets   |
|                                          |
| > Pull down            T40   [new best]  |
|    Set 1  [x] 12  [T40]  note          |
|    Set 2  [x] 12  [T40]                |
|    Set 3  [ ] 12  [T40]                |
|    Set 4  [ ] 12  [T40]                |
| > Seated row           T40              |
|    Set 1  [ ] 10  [T40]                |
|    ...                                   |
|                                          |
| +--------------------------------------+|
| |  (o)  0:42   -15   +15   skip        ||
| +--------------------------------------+|
+------------------------------------------+
```

Progress (dark)
```
+------------------------------------------+
| Progress                                  |
| Body weight and arm measurements.         |
|                                          |
|  Weight            82.4 kg  (+0.4)        |
|  +--------------------------------------+ |
|  |  ~~~ area fade, one hue ~~~         | |
|  |  . . . . . . . . . . . . . . . . .  | |
|  |  goal line -------------------------| |
|  +--------------------------------------+ |
|  7-day average  [legend]                 |
|                                          |
|  Arm (left)          38.2 cm  (+0.4 cm)  |
|  [chart]                                |
|  Arm (right)         37.9 cm  (-0.1 cm)  |
|  [chart]                                |
|                                          |
|  View session history                    |
+------------------------------------------+
```

---

# Direction B: bolder, stronger color per workout, larger numerals

A more assertive take. The same Notion structure, but each workout owns a saturated hue that is used as a filled block (cover, active tab, progress fill, timer ring), and the numerals and section headers are noticeably larger. It still respects the banned list: no gradients, no neon, no glass, no all-caps.

## Color tokens

Dark (default)
| Token | Hex | Use |
|---|---|---|
| bg | #0E1013 | page (deep ink, not pure black) |
| panel | #171A1F | cards, property rows |
| sheet | #1F242B | bottom sheets, timer bar |
| border | #2A3038 | 1px dividers |
| text | #F2F4F7 | primary text |
| text-2 | #8B94A1 | secondary text |
| accent | #4C8DFF | actions, active tab |

Per-workout hue (stronger, used as filled blocks). Not neon.
| Workout | Hex |
|---|---|
| Pull | #3E7BFF |
| Push | #2FA36B |
| Shoulders and arms | #E08A3C |

Light (mirror)
| Token | Hex |
|---|---|
| bg | #FFFFFF |
| panel | #F5F6F8 |
| sheet | #FFFFFF |
| border | #E2E4E9 |
| text | #1B1E24 |
| text-2 | #6B7280 |
| accent | #2563EB |

Per-workout hue on light: Pull #2563EB, Push #1F8A54, Shoulders and arms #C46A1E.

## Type
- Display face: Plus Jakarta Sans (700 to 800). Titles 30 to 34, bold. Big numerals 48 to 64.
- Body and data: Inter, tabular figures. Body 16.
- Sentence case. The larger numerals and heavier display face are the main difference from A.

## Layout concept
- Workout pages: a solid filled cover band in the workout hue (about 120px), title in white on top, then property rows. The fill is solid, not a low-opacity tint (that is A's move).
- Today: the week strip and the next-workout card use the workout hue as a filled accent (filled ring for done days, filled progress bar). Bigger numerals for the weight entry.
- Session: the active exercise gets a filled left border and a light tinted background. Set rows are taller. The top progress line is a filled bar in the workout hue.
- Rest timer: a filled ring in the workout hue around large numerals.
- Band picker: same as A, but the selected step is filled in the workout hue.
- Progress: charts with a filled area (solid, single hue, no gradient), a stronger line, and larger value labels.
- Icons: same custom outline set as A (1.75 stroke, round caps).
- Signature motion: same as A (infinity line draws on splash and session complete). B keeps the motion identical so the two directions differ in color and scale, not in behavior.
- Empty states: same as A.

## Wireframes

Today (dark)
```
+------------------------------------------+
| Today                                     |
| Your next workout and quick entries.      |
|                                          |
|  M   T   W   T   F   S   S              |
|  (O) ( ) (O) ( ) (O) ( ) ( )   <- filled |
|  Pull        Push      Shoulders         |
|                                          |
|  Session progress                        |
|  [==================----]  5 of 7 sets  |
|                                          |
|  Next workout                            |
|  +------------------------------------+  |
|  | [PULL] Pull, Monday   [Start]      |  |
|  +------------------------------------+  |
|                                          |
|  Weight (today)                          |
|  +------------------------------------+  |
|  |  82.4 kg      [ +0.2 ] [ -0.2 ]    |  |
|  +------------------------------------+  |
+------------------------------------------+
| Today  Plan  Progress  Settings  Nutrition|
+------------------------------------------+
```

Workout session (dark, Pull)
```
+------------------------------------------+
| Pull, Monday                 [Finish]     |
| [==================----]  5 of 7 sets    |
|                                          |
| | Pull down            T40   [new best]  |
| | Set 1  [x] 12  [T40]  note            |
| | Set 2  [x] 12  [T40]                 |
| | Set 3  [ ] 12  [T40]                 |
| | Set 4  [ ] 12  [T40]                 |
| > Seated row           T40               |
|   Set 1  [ ] 10  [T40]                  |
|   ...                                    |
|                                          |
| +--------------------------------------+|
| |  (O)  0:42   -15   +15   skip         ||
| +--------------------------------------+|
+------------------------------------------+
```

Progress (dark)
```
+------------------------------------------+
| Progress                                  |
| Body weight and arm measurements.         |
|                                          |
|  Weight            82.4 kg  (+0.4)       |
|  +--------------------------------------+ |
|  |  [solid filled area, one hue]       | |
|  |  . . . . . . . . . . . . . . . . .  | |
|  |  goal line -------------------------| |
|  +--------------------------------------+ |
|  7-day average  [legend]                 |
|                                          |
|  Arm (left)          38.2 cm  (+0.4 cm)  |
|  [chart]                                |
|  Arm (right)         37.9 cm  (-0.1 cm)  |
|  [chart]                                |
|                                          |
|  View session history                    |
+------------------------------------------+
```

---

# Review against the generic defaults

Direction A
- Cream/serif/terracotta: not used. Base is neutral dark, type is geometric sans, accent is blue. No change needed.
- Near-black with one acid accent: A is near-neutral (#191919) but it carries three muted workout hues plus a blue accent, so it is not a single-acid look. Kept the hues desaturated so none reads as acid.
- Purple or neon gradients: none. No gradients at all. The area fade in the chart is a single-hue opacity fade, not a gradient between colors.
- Grid of identical rounded cards: Today and Progress use property rows and stacked sections, not a card grid. Kept.
- Glassmorphism: none. Surfaces are flat with 1px borders; only sheets and the timer bar get a soft shadow.
- Sparkle/emoji/confetti/exclamation: none.
- What I changed from a naive read: I kept the workout hues desaturated (Notion tag colors) rather than saturated, and I limited shadows to sheets and the timer bar so the base stays flat.

Direction B
- Cream/serif/terracotta: not used. Base is deep ink (#0E1013), type is geometric sans, accents are blue/green/amber. No change needed.
- Near-black with one acid accent: B is the closest to this trap. I avoided it two ways: the base is a deep ink with a slight blue cast (not pure black), and the palette carries three workout hues plus a neutral accent, so no single acid color dominates. I kept the hues strong but below neon.
- Purple or neon gradients: none. The chart fill is a solid single hue, not a gradient.
- Grid of identical rounded cards: same as A, property rows and stacked sections. Kept.
- Glassmorphism: none.
- Sparkle/emoji/confetti/exclamation: none.
- What I changed from a naive read: I made the base a blue-cast ink instead of pure black, and I used the workout hues as filled blocks (cover, progress, ring) rather than as a single accent, so the bolder color does not collapse into the "one acid accent" default.

---

# Phase 2: what was built (Direction A)

Direction A was chosen and applied to the real app. Everything below is live in `app/src`.

- **Tokens and fonts.** `app/src/styles/tokens.css` carries the full Direction A set: three dark surface levels (bg, panel, sheet), the three muted workout hues, the ten desaturated muscle-group colors, Figtree (display) and Inter (body) self-hosted via `@fontsource`, a single `--shadow-soft` (used only on the band picker sheet and the rest timer bar), and a `--color-positive` for delta tags.
- **Session.** Infinity-line cover band in the workout hue, a thin progress line, each exercise as a toggle with its set rows inside, the active exercise with a 3px left border and a 5% hue tint, a checkbox that draws its check stroke on tap, a "new best" pill, and a session-complete view where the infinity line draws itself over 1.2s.
- **Rest timer.** A floating bottom bar with a depleting ring in the workout hue around large tabular numerals; minus 15, plus 15, and skip as text buttons.
- **Band picker.** A new bottom sheet: the Tube/Loop ladder as steps with the lb value, the last-used band underlined, the current band filled in the accent.
- **Today.** A week strip (Mon to Sun) with the three training days marked and done days as filled rings, a thin session progress line, the next workout as a card, and weight entry as a property row.
- **Progress.** Charts in one hue with a soft single-hue area fade, light gridlines, a direct label on the latest point, and delta tags such as +0.4 cm. Each chart sits in a card with a header row (title, latest value, delta).
- **Plan and exercise.** A cover band per workout (and per exercise) built from the infinity line in the workout hue at low opacity, property rows for the key facts, and the muscle map recolored to the per-group muscle colors (primary at full opacity, secondary at 45%).
- **Settings.** Flat property rows, Figtree section titles, panel cards, and the destructive reset in the error color.

Deviations from the wireframes: the Today weight row wraps its two buttons onto a second line so it does not overflow at 360px; the today-ring highlight uses an outline (a focus-ring style) rather than a box-shadow, to keep shadows limited to the two allowed surfaces. The reviewer passed the design checklist at 360 to 412 px with no open items.
