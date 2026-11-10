// The CSS color for a workout's hue token.
export function hueFor(workoutId: string): string {
  switch (workoutId) {
    case 'pull':
      return 'var(--hue-pull)'
    case 'push':
      return 'var(--hue-push)'
    case 'shoulders-arms':
      return 'var(--hue-shoulders)'
    case 'legs-forearms':
      return 'var(--hue-legs)'
    default:
      return 'var(--color-accent)'
  }
}
