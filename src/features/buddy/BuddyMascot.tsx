import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { BUDDY_ENABLED } from "@/features/buddy/buddyConfig";

/**
 * Persistent "exercise buddy" — a character fixed to the corner that appears on
 * every screen so the learner feels they are training together ("같이 운동해요").
 *
 * Pure sprite animation: each pose is a small set of full-frame PNGs cycled at
 * ~10fps. Loops (walk) play forward; gestures (wave / cheer / encourage) ping-pong
 * so the limbs return to rest instead of snapping back.
 *
 * Pose + placement are derived from the current route. Disabled by default
 * (see buddyConfig) — when off it renders nothing (zero DOM, no layout shift).
 */

type Pose = "idle" | "wave" | "cheer" | "jump" | "encourage";

const seq = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const png = (motion: string, n: number) => `/assets/haru/buddy/${motion}_${n}.png`;

const FRAMES: Record<Pose, string[]> = {
  idle: [png("idle", 1)],
  wave: seq(3).map((n) => png("wave", n)),
  cheer: seq(3).map((n) => png("cheer", n)),
  jump: seq(5).map((n) => png("jump", n)),
  // Single static encouraging frame on the lesson screen (no animation).
  encourage: [png("encourage", 1)],
};

// Per-pose tempo. Slow loops read as calm; gestures dwell at their peak so a
// wave/cheer holds the "up" beat instead of bouncing frantically.
const POSE_CONFIG: Record<
  Pose,
  { fps: number; pingPong: boolean; dwell: boolean }
> = {
  idle: { fps: 6, pingPong: false, dwell: false }, // static single frame
  wave: { fps: 5, pingPong: true, dwell: true },
  cheer: { fps: 5, pingPong: true, dwell: true },
  jump: { fps: 4, pingPong: false, dwell: true }, // weighty, holds apex
  encourage: { fps: 6, pingPong: false, dwell: false }, // static single frame
};

type Placement = { pose: Pose; position: string; size: string };

// Nav is hidden on /lesson, /result, /connect (AppShell.hideNavigationOnRoutes),
// so the buddy can sit low there. Everywhere else BottomNavigation (h-20) is
// present, so the buddy floats above it (bottom-24).
function placementFor(pathname: string): Placement {
  if (pathname.startsWith("/result"))
    return { pose: "jump", position: "bottom-4 right-4", size: "h-32 w-32" };
  return { pose: "idle", position: "bottom-24 right-4", size: "h-24 w-24" };
}

// Build the frame index order. Ping-pong gestures go 0..n-1 then n-2..1 so
// limbs return to rest instead of snapping. `dwell` repeats the peak/apex frame
// so the held beat reads clearly (hand stays up, jump hangs at the top).
function buildSequence(
  length: number,
  pingPong: boolean,
  dwell: boolean,
): number[] {
  const forward = Array.from({ length }, (_, i) => i);
  if (length < 3) return forward;

  if (!pingPong) {
    if (!dwell) return forward;
    const apex = Math.floor(length / 2);
    return [...forward.slice(0, apex), apex, ...forward.slice(apex)];
  }

  const peak = length - 1;
  const fwd = dwell ? [...forward.slice(0, -1), peak, peak] : forward;
  const backward = Array.from({ length: length - 2 }, (_, i) => length - 2 - i);
  return [...fwd, ...backward];
}

function Sprite({
  frames,
  fps,
  pingPong = false,
  dwell = false,
  className,
}: {
  frames: string[];
  fps: number;
  pingPong?: boolean;
  dwell?: boolean;
  className?: string;
}) {
  const order = useMemo(
    () => buildSequence(frames.length, pingPong, dwell),
    [frames.length, pingPong, dwell],
  );
  const [tick, setTick] = useState(0);

  // Preload every frame so the first loop doesn't flicker as images stream in.
  useEffect(() => {
    frames.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [frames]);

  useEffect(() => {
    if (order.length <= 1) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000 / fps);
    return () => window.clearInterval(id);
  }, [order.length, fps]);

  const index = order[tick % order.length];
  return <img src={frames[index]} alt="" className={className} />;
}

export function BuddyMascot() {
  const location = useLocation();
  if (!BUDDY_ENABLED) return null;
  // No buddy on the lesson screens — the learner is focused on the exercise.
  if (location.pathname.startsWith("/lesson")) return null;
  // No buddy on the connect screens (caregiver / counselor reports).
  if (location.pathname.startsWith("/connect")) return null;

  const { pose, position, size } = placementFor(location.pathname);
  const frames = FRAMES[pose];
  const cfg = POSE_CONFIG[pose];

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed z-30 ${position} ${size}`}
    >
      <Sprite
        key={pose}
        frames={frames}
        fps={cfg.fps}
        pingPong={cfg.pingPong}
        dwell={cfg.dwell}
        className="h-full w-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.18)]"
      />
    </div>
  );
}
