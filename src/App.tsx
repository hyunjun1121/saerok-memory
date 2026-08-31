import { lazy, Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { GamificationProvider } from '@/features/gamification/useGamification';
import { ensureDemoSeedCards } from '@/features/memory/memoryCardStorage';
import {
  recordHaruRouteView,
  startHaruTelemetry,
} from '@/features/analytics/client';

const ResultScreen = lazy(() => import('@/app/result/ResultScreen'));
const CaregiverAppScreen = lazy(() => import('@/app/connect/caregiver/CaregiverAppScreen'));
const CounselorAppScreen = lazy(() => import('@/app/connect/counselor/CounselorAppScreen'));
const CounselorParticipantScreen = lazy(() => import('@/app/connect/counselor/CounselorParticipantScreen'));
const LessonScreen = lazy(() => import('@/app/lesson/LessonScreen'));
const GardenScreen = lazy(() => import('@/app/garden/GardenScreen'));
const FamilyScreen = lazy(() => import('@/app/family/FamilyScreen'));
const SettingsScreen = lazy(() => import('@/app/settings/SettingsScreen'));
const OnboardingScreen = lazy(() => import('@/app/onboarding/OnboardingScreen'));
const KioskHomeScreen = lazy(() => import('@/app/kiosk/KioskHomeScreen'));

function LoadingFallback() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center">
      {t("app.loading")}
    </div>
  );
}

/**
 * Runs once on launch to (1) restore the last saved language and (2) seed the
 * demo memory card. Routing is static: the app has no Home hub — the default
 * landing is the routine start screen (/lesson, via the "/" redirect). Closing
 * or finishing the routine lands on the post-routine connect screen (/result).
 * Sits inside BrowserRouter so it can use router hooks.
 */
function LaunchGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Seed the demo "ate out yesterday" memory card so the recall question has
    // real grounding (idempotent — never overwrites user data).
    ensureDemoSeedCards();
    let disposed = false;
    let stopBackgroundSync: (() => void) | null = null;
    const stopTelemetry = startHaruTelemetry();
    void import('@/features/lessons/haruBackgroundSync').then(({ startHaruBackgroundSync }) => {
      if (!disposed) {
        stopBackgroundSync = startHaruBackgroundSync();
      }
    });

    return () => {
      disposed = true;
      stopBackgroundSync?.();
      stopTelemetry();
    };
  }, []);

  return <>{children}</>;
}

function TelemetryRouteObserver() {
  const location = useLocation();

  useEffect(() => {
    recordHaruRouteView(location.pathname);
  }, [location.pathname]);

  return null;
}

export default function App() {
  return (
    <GamificationProvider>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <LaunchGate>
          <TelemetryRouteObserver />
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Kiosk/tablet mode runs standalone (no app-shell nav, wider layout). */}
              <Route path="/kiosk" element={<KioskHomeScreen />} />
              <Route element={<AppShell />}>
                <Route path="/" element={<Navigate to="/lesson" replace />} />
                <Route path="/result" element={<ResultScreen />} />
                <Route path="/connect/caregiver" element={<CaregiverAppScreen />} />
                <Route path="/connect/counselor" element={<CounselorAppScreen />} />
                <Route path="/connect/counselor/participant/:id" element={<CounselorParticipantScreen />} />
                <Route path="/lesson" element={<LessonScreen />} />
                <Route path="/garden" element={<GardenScreen />} />
                <Route path="/family" element={<FamilyScreen />} />
                <Route path="/settings" element={<SettingsScreen />} />
                <Route path="/onboarding" element={<OnboardingScreen />} />
                <Route path="*" element={<Navigate to="/lesson" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </LaunchGate>
      </BrowserRouter>
    </GamificationProvider>
  );
}
