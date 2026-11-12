# Program guide
### How the 4 workouts fit together, with a specialization on arms and back and maintenance for everything else

## 1. Realistic expectations

Doubling arm circumference is not a realistic goal for a natural lifter: it would put you beyond the arms of most professional bodybuilders, who use drugs and train for a decade or more.

- Natural muscle gain is front-loaded: published estimates for an untrained young man range from roughly 4-7 kg of lean mass in a well-executed first year (conservative) up to about 9-11 kg (McDonald model), and the rate roughly halves each following year.
- That is whole-body muscle, and the arms get only a fraction of it. A realistic arm target is roughly +2-4 cm in year one and +5-8 cm over 2-3 years (my estimate from these rates, not a measured figure).
- Shoulders and back respond visibly too. Broader delts and a thicker back change how your upper body looks more than arm circumference alone.

Do bands work? Yes. A 2019 meta-analysis found that elastic resistance training gives strength gains similar to training with weights and machines. Bands do have a ceiling: your heaviest setup is about 120 lb (all three tubes stacked) or a 145 lb loop. If you stall for several weeks on everything below, a pair of adjustable dumbbells or a pull-up bar is the cheapest upgrade.

## 2. Weekly layout

| Day | Workout | Main focus | Duration |
|---|---|---|---|
| Monday | **Workout 1: Pull** | Back, rear delts, biceps, abs, obliques | About 65 min |
| Wednesday | **Workout 2: Push** | Triceps, chest, shoulders, abs | About 55 min |
| Friday | **Workout 3: Shoulders and arms** | Biceps, triceps, lats, rear delts, side delts | About 65 min (70 with the finisher) |
| Saturday | **Workout 4: Legs and forearms** | Seated row, curls and triceps first, then legs and forearms | About 75 min |

Durations include an 8 min warm-up and a 5 min cool-down. If you're short on time, drop the optional finisher in Workout 3 first, then one set from each isolation exercise. Saturday is the longest session: if you need to shorten it, cut the three forearm exercises to 2 sets each first.

Friday and Saturday are back to back, and both train biceps (Friday hard, Saturday only 2 sets of neutral-grip curls plus the Seated row). Workout 3 also works your forearms through the curls and the Close grip lift, so if your grip feels tired on Saturday, do fewer sets of the Wrist curl and Wrist extension or move Workout 4 to Sunday.

Specialization: arms and back. The goal of this program is to grow your arms and back, so those muscles are the priority and get specialization volume: biceps, triceps, lats and mid-back at 16-26 (biceps 16-28) weekly sets, forearms 12-20, rear delts 14-20 and upper traps 8-14. Each is trained 2-3 times a week and no single session gives any muscle more than 12 sets (with half credit), so every set can stay hard. Everything else, chest, front and side delts, abs, obliques and legs, is held at maintenance-to-moderate volume (roughly 4-12 sets) so that sessions stay under about 65 minutes of working time. Maintenance volume keeps the muscle you have, but you should expect slower growth there. Recovery is the limit with this much arm and back work: sleep, protein and a deload every 6-8 weeks matter more than usual, and if a muscle's performance drops for two sessions in a row, cut it by 2-3 sets for a week.

Weekly hard sets per muscle. There is no single right number for every muscle, so each one has its own target range (stored in `plan.json` as `muscleTargets`, and shown on the Plan screen). "Direct" counts sets where the muscle is primary. "With half credit" adds half a set for each set where it is secondary, and is the number compared with the range. Unilateral exercises count rounds, not sides (3 rounds is 3 sets for each arm or leg). The optional finisher in Workout 3 is included in these numbers.

| Muscle | Direct sets | With half credit | Target range |
|---|---|---|---|
| Biceps (priority) | 15 | 26 | 16-28 |
| Triceps (priority) | 17 | 21 | 16-26 |
| Lats (priority) | 21 | 21 | 16-26 |
| Mid-back (priority) | 11 | 19 | 16-26 |
| Rear delts (priority) | 9 | 16.5 | 14-20 |
| Forearms (priority) | 9 | 17 | 12-20 |
| Upper traps (priority) | 4 | 8.5 | 8-14 |
| Side delts | 10 | 10 | 6-12 |
| Front delts | 3 | 5.5 | 4-10 |
| Chest | 8 | 8 | 6-12 |
| Abs | 6 | 7 | 4-10 |
| Obliques | 2 | 2 | 2-6 |
| Lower back | 0 | 4.5 | 2-8 |
| Rotator cuff | 0 | 1.5 | 1-6 |
| Quads | 5 | 5 | 4-10 |
| Glutes | 8 | 8 | 4-10 |
| Hamstrings | 3 | 5.5 | 4-10 |
| Calves | 3 | 3 | 3-8 |

Why the ranges differ. Dose-response work (Schoenfeld et al. 2017; Pelland et al. 2024) shows more hypertrophy with more weekly sets, with diminishing returns, and about 10 or more weekly sets per muscle as the usual aim. Some trials in trained men suggest that going well above that still helps: Brigatto et al. compared 16, 24 and 32 weekly sets per muscle group and found muscle thickness tended to rise with volume (not every comparison was significant), and Enes et al. had trained men add sets to quad training up to 52 per week and reported continued gains, though the hypertrophy results need cautious reading. That is why the priority muscles are planned in the upper half of a 16-26 range. This evidence is limited: those trials are small, short, in young men with good recovery, and Enes studied quads rather than arms or back, so the best volume for your arms and back is uncertain and differs between people. The Pelland analysis is a preprint, and it did not name a volume at which gains stop. Treat the targets as a reasonable plan to adjust by how you recover.

For the rest, muscles that are not a priority are held at maintenance-to-moderate ranges: chest and side delts (6-12), front delts (4-10, they get a lot of work from every press), abs (4-10), obliques (2-6, little data, so a modest guess), quads and glutes (4-10), hamstrings (4-10), calves (3-8), lower back (2-8) and rotator cuff (1-6). Half credit for secondary work is a convention that nobody has measured, so treat a muscle that sits at the edge of its range as fine.

Biceps are the highest-volume muscle (26 sets with half credit, 24 without the Workout 3 finisher): direct curls on Monday, Friday and Saturday plus every pulling exercise. If your elbows or biceps feel sore or flat, cut the Workout 3 finisher first, then one set of Side pull biceps.

## 3. Pilates bar setups and tube pairing

Three setups are used across the workouts:

| Setup | How |
|---|---|
| **Door and bar** | Door anchor on the door. A tube runs from the anchor to each end of the bar. |
| **Bar in hands, feet in handles** | A tube clipped to each end of the bar. Put a foot in the handle at the other end of each tube. Stand wider for more tension. |
| **Bar under feet** | Lay the bar on the floor and stand on it. A tube on each end, hold the handle at the far end of each tube. |

Two more are used once each: bar on chest with a tube under you (Grip press) and bar on back with feet in handles (Squat).

Tube pairing. Exercises that load both ends of the bar need two tubes of the same rating, or the bar tilts and one side works harder.
- If you own two tubes of the same rating, use that pair. If you own only one of each (30, 40, 50 lb), use the closest pair (30 and 40, or 40 and 50) for exercises where each arm pulls on its own tube (Reverse fly, Bend over fly, Hex press, Lateral raises) and swap sides every set.
- For door exercises (Pull down, Seated row, Standing press, Push down), you can run one tube from one end of the bar, through the door anchor, to the other end, so both sides carry exactly the same load.
- Never use a damaged tube, and check every clip is fully closed before loading.

## 4. Progressive overload with bands

You can't add a 2 kg plate, so you progress by making the band harder or the set longer. Use this order:

1. Add reps until you can do the top of the range (or 20+ reps for the 15-20 rep exercises) with 1-2 reps left in reserve.
2. Slow the lowering to 4 s, and add a 2 s pause at the hardest point.
3. Increase tension, in this order: step back or stand wider, choke up on the band, move to the next band, stack tubes.
4. Go single-arm on rows, pull downs and presses when you run out of band.

Tube ladder (ratings are at full stretch, so real load mid-range is lower):

| Step | Setup |
|---|---|
| 1 | 30 lb |
| 2 | 40 lb |
| 3 | 50 lb |
| 4 | 30 + 40 |
| 5 | 30 + 50 |
| 6 | 40 + 50 |
| 7 | 30 + 40 + 50 |

Loop ladder: 5-30, 15-50, 25-75, 35-95, 50-145.

> **Stacking tubes:** only stack if the clips, handles and bar are rated for it and every tube is undamaged.

Effort rule: most sets finish with 1-2 reps left in reserve. The last set of each exercise goes to failure when it is safe (curls, raises, push downs, rows).

Deload: every 6-8 weeks, do one week at half the sets with the same bands.

## 5. Eating and recovery

- Calories: a small surplus (about +250-500 kcal/day above maintenance) supports muscle gain. Eating at maintenance or below limits growth.
- Protein: around 1.6-2.2 g per kg of body weight per day, spread over 3-4 meals.
- Sleep: aim for 7-9 hours.
- Gaining weight on the scale (about 0.25-0.5 kg per month at first) is a good sign.

## 6. Measuring progress

Measure every 4 weeks, at the same time of day, relaxed (not flexed):

| What | How |
|---|---|
| Upper arm | Midway between shoulder tip and elbow, arm hanging relaxed, tape snug but not tight |
| Shoulders | Around the widest point of the shoulders, over the deltoids |
| Chest | Around the nipple line, after a normal exhale |
| Body weight | Morning, same conditions each time |

| Date | Arm L / R (cm) | Shoulders (cm) | Chest (cm) | Weight (kg) |
|---|---|---|---|---|
| | | | | |

## 7. Exercise names and muscle mapping

I used the names from your band chart. Primary muscles count in full and secondary muscles count half.

| Exercise | Primary | Secondary |
|---|---|---|
| Pull down | Lats | Biceps, mid-back, rear delts |
| Pull down (underhand) | Lats, biceps | Mid-back |
| Seated row | Mid-back, lats | Biceps, rear delts |
| Bend over rows (loop) | Mid-back, lats | Biceps, rear delts, lower back |
| Push down (straight-arm) | Lats | None |
| Reverse fly | Rear delts | Mid-back |
| Bend over fly | Rear delts | Mid-back, lower back |
| Face pull | Rear delts | Upper traps, mid-back, rotator cuff |
| Close grip barbell, Wide grip barbell, Bicep curls (loop) | Biceps | Forearms |
| Grip press | Chest | Front delts, triceps |
| Hex press | Chest | Front delts, triceps |
| Standing press | Front delts, chest | Triceps |
| Cable crossover | Chest | Front delts |
| Lateral raises, Lateral raise (loop) | Side delts | Upper traps |
| Close grip lift | Side delts, upper traps | Biceps, forearms |
| Push-down tricep, Triceps extension (loop) | Triceps | None |
| V-ups | Abs | Hip flexors |
| Kneeling crunch | Abs | None |
| Trunk twist (loop) | Obliques | Abs |
| Squat | Quads, glutes | Hamstrings |
| Romanian deadlift | Hamstrings, glutes | Lower back |
| Lunges (loop) | Quads, glutes | Hamstrings |
| Ankle plantarflexion (loop) | Calves | None |
| Reverse curl | Forearms | Biceps |
| Wrist curl, Wrist extension | Forearms | None |

Muscle keys the app needs: chest, front delts, side delts, rear delts, upper traps, mid-back, lats, lower back, biceps, triceps, forearms, abs, obliques, rotator cuff (optional), quads, glutes, hamstrings, calves. Hip flexors (secondary on V-ups) can be left out.

Interpretations I made (check them against the pictures on your chart): Push down (straight-arm lat push down), Wide grip barbell and Close grip barbell (curls with the bar), Cable crossover (sweep down and across from a high anchor), V-ups (V-up with a tube held overhead), Kneeling crunch (kneeling cable-style crunch), Trunk twist (standing rotation against a band).

Not on your chart: Face pull, Romanian deadlift, Reverse curl, Wrist curl and Wrist extension. I added them for rear delts and shoulder health, hamstrings, and forearms.

Not in any workout: Glute kickbacks (dropped earlier), Upright row, Glute bridge and Cable crossover. Their data stays in the app so logged history is kept. Upright row, Glute bridge and Cable crossover were removed because side delts, glutes and chest are now at maintenance. Curl biceps (neutral grip) and Side pull biceps came back for the arm specialization.

Not used: Upper oblique, Lower oblique, Hip flexion, Band squat, 1-leg miniquat, Russian twist, Reverse crunch, Diagonal wood chops. The Lying chest press (loop) is kept as the heavier alternative to the Grip press when the tubes are no longer enough.
