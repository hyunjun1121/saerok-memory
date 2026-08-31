import { useCallback, useEffect, useState } from "react";
import { Nfc } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { audioManager } from "@/features/audio";
import { useNfcLoginInput } from "@/features/login/nfcLoginInput";
import { getBuildLanguage, getUiCopy } from "@/i18n/copy";

interface NfcLoginScreenProps {
  readonly onAuthenticated: () => void;
}

export function NfcLoginScreen({ onAuthenticated }: NfcLoginScreenProps) {
  const language = getBuildLanguage();
  const [audioUnavailable, setAudioUnavailable] = useState(false);

  const authenticate = useCallback(() => {
    audioManager.stopNarration();
    onAuthenticated();
  }, [onAuthenticated]);

  useNfcLoginInput(authenticate);

  useEffect(() => {
    let active = true;
    void audioManager.playNarration("login.nfc.waiting", language).then((result) => {
      if (!active) {
        audioManager.stopNarration();
        return;
      }
      if (result.status !== "played") setAudioUnavailable(true);
    });
    return () => {
      active = false;
      audioManager.stopNarration();
    };
  }, [language]);

  return (
    <AppFrame
      dayLabel={getUiCopy(language, "loginLabel")}
      showButtonGuide={false}
    >
      <section
        className="hero-card nfc-login-card"
        data-screen="nfc-login"
        data-login-state="waiting"
        data-auth-method="nfc-keyboard-5"
        aria-live="polite"
      >
        <div className="nfc-login__visual" aria-hidden="true">
          <div className="nfc-login__ring">
            <Nfc className="nfc-login__icon" strokeWidth={1.8} />
          </div>
        </div>
        <span className="question-copy__eyebrow">{getUiCopy(language, "loginLabel")}</span>
        <h1>{getUiCopy(language, "loginTitle")}</h1>
        <p>{getUiCopy(language, "loginBody")}</p>
        <p className="nfc-login__hint">{getUiCopy(language, "loginHint")}</p>
        {audioUnavailable ? (
          <p className="audio-warning">{getUiCopy(language, "audioUnavailable")}</p>
        ) : null}
      </section>
    </AppFrame>
  );
}
