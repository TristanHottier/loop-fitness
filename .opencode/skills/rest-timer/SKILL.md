---
name: Rest Timer
description: Timer logic, Wake Lock API, and background handling.
---

# Timer Implementation

## Core Logic
- The timer relies on absolute timestamps (`endTime`), not a running interval counter.
- Recompute the remaining time on the `visibilitychange` event. This ensures accuracy even if the browser aggressively throttles the inactive tab.
- Provide controls: -15s, +15s, and Skip.
- Play a short chime and trigger a vibration upon completion.

## Device API Usage
- Use the Screen Wake Lock API (`navigator.wakeLock.request('screen')`) to keep the screen awake during the session.
- **Known Limit**: The Web App cannot play audio or ring if the user manually locks the screen. State this limitation clearly in the UI.

## Exceptions
1. **Unilateral Exercises**: The timer starts only after the second side is logged.
