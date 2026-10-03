---
name: Plan Data and Progression
description: JSON schema rules, band ladders, progression logic, and due prompts.
---

# Band Ladders (lb)
- **Tube (T)**: `30`, `40`, `50`, `30+40`, `40+50`, `30+40+50`
- **Loop (L)**: `5-30`, `15-50`, `25-75`, `35-95`, `50-145`

# Schema Notes
Each exercise requires: `slug`, `name`, `equipment`, `repMin`, `repMax`, `sets`, `restSeconds`, `startBand`, `unilateral`, `optional`.
*Note: Unilateral exercises (e.g., Side pull biceps) require one logged set per side.*

# Progression Suggestion Rule
Evaluate after a session for each exercise:
1. **Next Band**: If *every* set hit `repMax` with the same band, suggest the next band on the ladder (or "single-arm" if already at the top).
2. **Hold**: If *any* set is under `repMin`, suggest staying on the current band.
3. Show the suggestion as a note on the exercise card during the next session.

# Due Prompts
- **Arm Measurement**: Prompt due every 4 weeks.
- **Deload Week**: Prompt due every 6 to 8 weeks (instruct the user to do half the sets with the same bands).
