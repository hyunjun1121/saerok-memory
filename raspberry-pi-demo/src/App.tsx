import { useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import {
  FamilyMenuScreen,
  InfoScreen,
  KioskMenuScreen,
  OnboardingScreen,
  PagedReportScreen,
  SettingsScreen,
  SupportConnectionScreen,
} from "@/app/OverviewScreens";
import { loadRuntimeInputConfig, type RuntimeInputConfigResult } from "@/config/runtimeConfig";
import { audioManager } from "@/features/audio";
import { FourButtonProvider } from "@/features/input";
import { OfflineLessonScreen, OfflineResultScreen } from "@/features/lesson/OfflineLesson";
import { getBuildLanguage, getUiCopy } from "@/i18n/copy";

function AppRoutes() {
  const language = getBuildLanguage();
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/lesson" replace />} />
      <Route path="/lesson" element={<OfflineLessonScreen />} />
      <Route path="/result" element={<OfflineResultScreen />} />
      <Route path="/kiosk" element={<KioskMenuScreen />} />
      <Route
        path="/garden"
        element={(
          <InfoScreen
            title={getUiCopy(language, "gardenTitle")}
            body={getUiCopy(language, "gardenBody")}
            image="/assets/haru/mascot_turtle.jpg"
            nextPath="/kiosk"
          />
        )}
      />
      <Route path="/family" element={<FamilyMenuScreen />} />
      <Route path="/connect" element={<SupportConnectionScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="/onboarding" element={<OnboardingScreen />} />
      <Route
        path="/connect/caregiver"
        element={(
          <PagedReportScreen
            heading={getUiCopy(language, "caregiverTitle")}
            intro={getUiCopy(language, "caregiverPages")}
          />
        )}
      />
      <Route
        path="/connect/counselor"
        element={(
          <PagedReportScreen
            heading={getUiCopy(language, "counselorTitle")}
            intro={getUiCopy(language, "counselorPages")}
          />
        )}
      />
      <Route
        path="/connect/counselor/participant/:id"
        element={(
          <PagedReportScreen
            heading={getUiCopy(language, "participantTitle")}
            intro={getUiCopy(language, "participantBody")}
          />
        )}
      />
      <Route path="*" element={<Navigate to="/lesson" replace />} />
    </Routes>
  );
}

export default function App() {
  const language = getBuildLanguage();
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeInputConfigResult | null>(null);

  useEffect(() => {
    let disposed = false;
    void loadRuntimeInputConfig().then((result) => {
      if (disposed) return;
      setRuntimeConfig(result);
      if (result.status === "ready") void audioManager.load();
    });
    return () => {
      disposed = true;
    };
  }, []);

  if (runtimeConfig === null) {
    return (
      <div className="boot-screen" role="status">
        <img src="/assets/haru/app_icon.png" alt="" />
        <strong>{getUiCopy(language, "loading")}</strong>
      </div>
    );
  }

  if (runtimeConfig.status === "error") {
    return (
      <div className="boot-screen boot-screen--error" role="alert" data-screen="runtime-error">
        <img src="/assets/haru/app_icon.png" alt="" />
        <strong>{getUiCopy(language, "configErrorTitle")}</strong>
        <span>{getUiCopy(language, "configErrorBody")}</span>
      </div>
    );
  }

  return (
    <FourButtonProvider config={runtimeConfig.config}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </FourButtonProvider>
  );
}
