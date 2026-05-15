import { Outlet, useLocation } from "react-router-dom";
import { TopStatusBar } from "./TopStatusBar";
import { BottomNavigation } from "./BottomNavigation";
import { useGamification } from "../features/gamification/useGamification";

export function AppShell() {
  const location = useLocation();
  const { streakState, gardenState } = useGamification();

  const hideNavigationOnRoutes = ["/lesson", "/result"];
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
    </div>
  );
}
