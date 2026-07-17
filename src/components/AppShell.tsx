import { Outlet, useLocation } from "react-router-dom";
import { TopStatusBar } from "@/components/TopStatusBar";
import { BottomNavigation } from "@/components/BottomNavigation";
import { BuddyMascot } from "@/features/buddy/BuddyMascot";
import { useGamification } from "@/features/gamification/useGamification";

export function AppShell() {
  const location = useLocation();
  const { streakState, gardenState } = useGamification();

  const hideNavigationOnRoutes = ["/lesson", "/result", "/connect"];
  const isNavigationHidden = hideNavigationOnRoutes.some((route) =>
    location.pathname.startsWith(route)
  );

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {!isNavigationHidden && (
        <TopStatusBar streak={streakState.currentStreak || 0} gardenPoints={gardenState.waterDrops || 0} />
      )}

      <main className="flex-1 w-full max-w-md mx-auto relative pb-20">
        <Outlet />
      </main>

      {!isNavigationHidden && <BottomNavigation />}

      {/* Exercise-buddy mascot. Renders nothing while BUDDY_ENABLED is false. */}
      <BuddyMascot />
    </div>
  );
}
