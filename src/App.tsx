import { lazy, Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { GamificationProvider } from './features/gamification/useGamification';
import { getLearnerProfile } from './features/profile/learnerProfileStorage';
import { isTodayRoutineCompleted } from './features/cognitive/cognitiveRoutineStorage';

const HomeScreen = lazy(() => import('./app/home/HomeScreen'));
const ResultScreen = lazy(() => import('./app/result/ResultScreen'));
const LessonScreen = lazy(() => import('./app/lesson/LessonScreen'));
const GardenScreen = lazy(() => import('./app/garden/GardenScreen'));
const FamilyScreen = lazy(() => import('./app/family/FamilyScreen'));
const SettingsScreen = lazy(() => import('./app/settings/SettingsScreen'));
const OnboardingScreen = lazy(() => import('./app/onboarding/OnboardingScreen'));
const KioskHomeScreen = lazy(() => import('./app/kiosk/KioskHomeScreen'));

function LoadingFallback() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center">
      {t("app.loading")}
    </div>
  );
}

/**
 * Runs once on launch to (1) send a brand-new learner to the short first-run
 * onboarding, (2) restore the last saved language, and (3) 0-tap into today's
 * routine when auto-start is enabled and today is not yet done. Sits inside
 * BrowserRouter so it can use router hooks. Only acts on the "/" path, so the
 * standalone /kiosk route and direct deep links are unaffected.
 */
function LaunchGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  useEffect(() => {
    const profile = getLearnerProfile();

    const savedLang = localStorage.getItem("memoryGardenLang");
    if (savedLang && savedLang !== i18n.language) {
      i18n.changeLanguage(savedLang);
    }

    if (location.pathname !== "/") {
      return;
    }

    // First-run onboarding takes priority over auto-start.
    if (!profile.onboarded) {
      navigate("/onboarding", { replace: true });
      return;
    }

    if (profile.autoStartTodayRoutine && !isTodayRoutineCompleted()) {
      navigate("/lesson", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}

export default function App() {
  return (
    <GamificationProvider>
      <BrowserRouter>
        <LaunchGate>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Kiosk/tablet mode runs standalone (no app-shell nav, wider layout). */}
              <Route path="/kiosk" element={<KioskHomeScreen />} />
              <Route element={<AppShell />}>
                <Route path="/" element={<HomeScreen />} />
                <Route path="/result" element={<ResultScreen />} />
                <Route path="/lesson" element={<LessonScreen />} />
                <Route path="/garden" element={<GardenScreen />} />
                <Route path="/family" element={<FamilyScreen />} />
                <Route path="/settings" element={<SettingsScreen />} />
                <Route path="/onboarding" element={<OnboardingScreen />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </LaunchGate>
      </BrowserRouter>
    </GamificationProvider>
  );
}
