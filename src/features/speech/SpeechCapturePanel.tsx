import { twMerge } from "tailwind-merge";
import { Mic, Square } from "lucide-react";
import { Button3D } from "../../components/Button3D";

export interface SpeechCapturePanelProps {
  isSupported: boolean;
  isListening: boolean;
  onStart: () => void;
  onStop: () => void;
  startLabel: string;
  stopLabel: string;
  listeningTitle: string;
  listeningBody: string;
  unsupportedNote: string;
  durationHint?: string;
  className?: string;
}

// Reusable speech-first capture UI. Shows a large, clearly-labeled "listening"
// state (mentor requirement: the user must see the app is listening). When the
// SpeechRecognition API is unavailable, only the typed-input fallback note is
// shown — the routine stays completable without speech.
export function SpeechCapturePanel({
  isSupported,
  isListening,
  onStart,
  onStop,
  startLabel,
  stopLabel,
  listeningTitle,
  listeningBody,
  unsupportedNote,
  durationHint,
  className,
}: SpeechCapturePanelProps) {
  if (!isSupported) {
    return (
      <p
        className={twMerge(
          "rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-base font-semibold leading-relaxed text-amber-800",
          className,
        )}
      >
        {unsupportedNote}
      </p>
    );
  }

  return (
    <section
      className={twMerge(
        "flex flex-col gap-4 rounded-2xl border-[3px] p-5 transition-colors",
        isListening
          ? "border-primary-500 bg-primary-50 ring-4 ring-primary-200"
          : "border-pink-100 bg-pink-50",
        className,
      )}
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div
          className={twMerge(
            "flex h-12 w-12 items-center justify-center rounded-xl shadow-sm",
            isListening ? "bg-white text-primary-600" : "bg-white text-pink-500",
          )}
        >
          <Mic className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="flex flex-col">
          <h3
            className={twMerge(
              "flex items-center gap-2 text-lg font-extrabold",
              isListening ? "text-primary-700" : "text-ink",
            )}
          >
            {isListening && (
              <span
                className="inline-flex items-end gap-1"
                role="img"
                aria-label={listeningTitle}
              >
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full bg-primary-500 motion-safe:animate-pulse"
                    style={{
                      height: `${8 + ((i % 3) + 1) * 4}px`,
                      animationDelay: `${i * 0.12}s`,
                    }}
                  />
                ))}
              </span>
            )}
            {isListening ? listeningTitle : startLabel}
          </h3>
          <p className="text-sm font-semibold text-gray-600">
            {isListening ? listeningBody : (durationHint ?? listeningBody)}
          </p>
        </div>
      </div>

      <Button3D
        variant={isListening ? "danger" : "primary"}
        fullWidth
        size="lg"
        aria-pressed={isListening}
        onClick={isListening ? onStop : onStart}
      >
        {isListening ? (
          <>
            <Square className="mr-2 h-5 w-5" aria-hidden="true" />
            {stopLabel}
          </>
        ) : (
          <>
            <Mic className="mr-2 h-5 w-5" aria-hidden="true" />
            {startLabel}
          </>
        )}
      </Button3D>
    </section>
  );
}
