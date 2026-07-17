/**
 * Global on/off switch for the "exercise buddy" mascot — the character that
 * trains alongside the learner on every screen ("같이 운동해요" concept).
 *
 * Default ON: sprite frames have landed in /public/assets/haru/buddy/ and the
 * route→pose wiring is in place. To fully restore the character-free baseline,
 * set VITE_BUDDY_ENABLED=false (or remove the <BuddyMascot /> mount in AppShell)
 * — the disabled component returns null, so there is zero DOM and no layout
 * shift.
 */
export const BUDDY_ENABLED =
  ((import.meta.env.VITE_BUDDY_ENABLED as string | undefined) ?? "true").toLowerCase() ===
  "true";
