import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button3D } from "../../components/Button3D";
import {
  saveLearnerProfile,
  type PreferredInputMode,
} from "../../features/profile/learnerProfileStorage";

const LANGUAGES = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
] as const;

const INPUT_MODES: { id: PreferredInputMode; key: string }[] = [
  { id: "speech", key: "onboarding.inputMode.speech" },
  { id: "tap", key: "onboarding.inputMode.tap" },
  { id: "mixed", key: "onboarding.inputMode.mixed" },
];

/**
 * Short first-run gate (HL-7). Three low-friction steps: language, large text,
 * input mode. Non-medical copy only; nothing here implies a deficit. On finish
 * the profile is marked onboarded and the learner returns to Home (where the
 * auto-start gate takes over if enabled).
 */
export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState(i18n.language?.slice(0, 2) || "ko");
  const [largeTextMode, setLargeTextMode] = useState(false);
  const [inputMode, setInputMode] = useState<PreferredInputMode>("speech");

  const applyLanguage = (code: string) => {
    setLanguage(code);
    i18n.changeLanguage(code);
    localStorage.setItem("memoryGardenLang", code);
  };

  const finish = () => {
    saveLearnerProfile({ onboarded: true, preferredInputMode: inputMode, largeTextMode });
    navigate("/", { replace: true });
  };

  const isLast = step === 2;

  return (
    <div
      data-screen="onboarding"
      className="flex flex-col min-h-[100dvh] px-6 pt-12 pb-8 w-full max-w-md mx-auto bg-[var(--color-surface-warm)]"
    >
      <h1 className="text-3xl font-extrabold text-ink text-center mb-2">
        {t("onboarding.title")}
      </h1>
      <p className="text-base font-medium text-muted text-center mb-10">
        {t("onboarding.welcomeBody")}
      </p>

      {step === 0 && (
        <section className="flex flex-col gap-3" aria-label={t("onboarding.step.languageTitle")}>
          <h2 className="text-xl font-bold text-ink mb-2">
            {t("onboarding.step.languageTitle")}
          </h2>
          {LANGUAGES.map((lng) => (
            <Button3D
              key={lng.code}
              variant={language === lng.code ? "primary" : "secondary"}
              fullWidth
              size="xl"
              onClick={() => applyLanguage(lng.code)}
            >
              {lng.label}
            </Button3D>
          ))}
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-3" aria-label={t("onboarding.step.largeTextTitle")}>
          <h2 className="text-xl font-bold text-ink mb-1">
            {t("onboarding.step.largeTextTitle")}
          </h2>
          <p className="text-base font-medium text-muted mb-2">
            {t("onboarding.step.largeTextHint")}
          </p>
          <Button3D
            variant={largeTextMode ? "primary" : "secondary"}
            fullWidth
            size="xl"
            onClick={() => setLargeTextMode(true)}
          >
            {t("onboarding.largeTextOn")}
          </Button3D>
          <Button3D
            variant={!largeTextMode ? "primary" : "secondary"}
            fullWidth
            size="xl"
            onClick={() => setLargeTextMode(false)}
          >
            {t("onboarding.largeTextOff")}
          </Button3D>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-3" aria-label={t("onboarding.step.inputModeTitle")}>
          <h2 className="text-xl font-bold text-ink mb-2">
            {t("onboarding.step.inputModeTitle")}
          </h2>
          {INPUT_MODES.map((mode) => (
            <Button3D
              key={mode.id}
              variant={inputMode === mode.id ? "primary" : "secondary"}
              fullWidth
              size="xl"
              onClick={() => setInputMode(mode.id)}
            >
              {t(mode.key)}
            </Button3D>
          ))}
        </section>
      )}

      <div className="mt-auto pt-8">
        {isLast ? (
          <Button3D variant="primary" size="xl" fullWidth onClick={finish}>
            {t("onboarding.finish")}
          </Button3D>
        ) : (
          <Button3D
            variant="primary"
            size="xl"
            fullWidth
            onClick={() => setStep((s) => s + 1)}
          >
            {t("onboarding.next")}
          </Button3D>
        )}
      </div>
    </div>
  );
}
