import { twMerge } from "tailwind-merge";
import { Mic, Square } from "lucide-react";
import { Button3D } from "@/components/Button3D";
import { VoiceWaveform } from "@/features/speech/VoiceWaveform";

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
  /** Live mic amplitude bins (0..1) driving the reactive waveform. */
  levels?: number[];
  className?: string;
}

// Reusable speech-first capture UI. Shows a large, clearly-labeled "listening"
// state with a reactive voice waveform (mentor requirement: the user must see
// and feel the app is capturing their voice). When neither SpeechRecognition nor
// a mic stream is available, only the typed-input fallback note is shown — the
// routine stays completable without speech.
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
  levels = [],
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
          ? "border-red-500 bg-red-50 ring-4 ring-red-200"
          : "border-pink-100 bg-pink-50",
        className,
      )}
      aria-live="polite"
    >
      <div className="flex items-center gap-4">
        <div
          className={twMerge(
            "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-sm",
            isListening ? "bg-red-100" : "bg-white text-pink-500",
          )}
        >
          {isListening ? (
            <span className="relative flex h-7 w-7" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-7 w-7 rounded-full bg-red-600" />
            </span>
          ) : (
            <Mic className="h-7 w-7" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col">
          <h3
            className={twMerge(
              "text-2xl font-extrabold leading-tight",
              isListening ? "text-red-600" : "text-ink",
            )}
          >
            {isListening ? listeningTitle : startLabel}
          </h3>
          <p className="text-base font-semibold text-gray-600">
            {isListening ? listeningBody : (durationHint ?? listeningBody)}
          </p>
        </div>
      </div>

      {isListening && (
        <VoiceWaveform
          levels={levels}
          active
          barClassName="bg-red-500"
          ariaLabel={listeningTitle}
        />
      )}

      <Button3D
        variant={isListening ? "danger" : "primary"}
        fullWidth
        size="lg"
        aria-pressed={isListening}
        onClick={isListening ? onStop : onStart}
        data-recording-toggle
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
