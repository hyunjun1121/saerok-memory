import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Play } from "lucide-react";
import { Button3D } from "../../../components/Button3D";
import type { ExerciseState } from "./types";
import { saveCognitiveRoutineResult } from "../../cognitive/cognitiveRoutineStorage";

interface SpeechRepeatPracticeProps {
  prompt: string;
  phrase: string;
  onComplete: () => void;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

export function SpeechRepeatPractice({
  prompt,
  phrase,
  onComplete,
  setGlobalState,
  globalState,
}: SpeechRepeatPracticeProps) {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [speechApiAvailable] = useState(() => "webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  useEffect(() => {
    if (globalState === "awaiting_answer" || globalState === "answer_selected") {
      setGlobalState("answer_selected"); // Let the user proceed anytime
    }
  }, [globalState, setGlobalState]);

  const handlePlay = () => {
    if (!("speechSynthesis" in window)) return;

    setIsPlaying(true);
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = "ko-KR";
    utterance.onend = () => setIsPlaying(false);
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    if (!speechApiAvailable) return;

    try {
      // Use defensive typing for the speech API
      type FallbackSpeechRecognitionEvent = Event & { results: { transcript: string }[][] };
      type FallbackSpeechRecognition = EventTarget & {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        start: () => void;
        onstart: () => void;
        onresult: (e: FallbackSpeechRecognitionEvent) => void;
        onerror: (e: Event & { error?: string }) => void;
        onend: () => void;
      };

      const w = window as unknown as { SpeechRecognition?: new () => FallbackSpeechRecognition, webkitSpeechRecognition?: new () => FallbackSpeechRecognition };
      const SpeechRecognitionConstructor = w.SpeechRecognition || w.webkitSpeechRecognition;

      if (!SpeechRecognitionConstructor) return;

      const recognition = new SpeechRecognitionConstructor();
      recognition.lang = "ko-KR";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: FallbackSpeechRecognitionEvent) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
      };

      recognition.onerror = (event: Event & { error?: string }) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.error("Failed to start speech recognition", e);
      setIsListening(false);
    }
  };

  const handleCheck = () => {
    saveCognitiveRoutineResult({
      type: "speech_repeat_practice",
      completed: true,
      metadata: { phrase, transcript }
    });

    setGlobalState("correct_feedback");
    onComplete(); // Move on directly
  };

  return (
    <div className="flex flex-col w-full gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-blue-500 uppercase tracking-wide">
          {t("exercise.cognitive.practice", "말하기 연습")}
        </span>
        <h2 className="text-3xl font-extrabold text-ink leading-snug">{prompt}</h2>
      </div>

      <div className="flex flex-col items-center justify-center gap-6 py-8">
        <div className="text-3xl font-extrabold text-ink p-6 bg-blue-50 rounded-2xl border-2 border-blue-100 text-center leading-snug w-full shadow-sm">
          "{phrase}"
        </div>

        <div className="flex gap-4">
          <button
            onClick={handlePlay}
            disabled={isPlaying}
            className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-gray-200 font-bold text-gray-700 hover:bg-gray-50 transition active:scale-95 disabled:opacity-50"
          >
            <Play size={20} className={isPlaying ? "text-blue-500" : ""} />
            {t("exercise.cognitive.listen", "들어보기")}
          </button>

          {speechApiAvailable && (
            <button
              onClick={startListening}
              disabled={isListening}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl border-2 font-bold transition active:scale-95 disabled:opacity-50 ${
                isListening ? "border-red-500 text-red-500 bg-red-50" : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Mic size={20} className={isListening ? "animate-pulse" : ""} />
              {isListening ? t("exercise.cognitive.listening", "듣는 중...") : t("exercise.cognitive.speak", "따라 말하기")}
            </button>
          )}
        </div>
      </div>

      <div className="fixed bottom-[96px] left-0 right-0 px-4 max-w-md mx-auto z-30">
        <Button3D
          variant="primary"
          fullWidth
          onClick={handleCheck}
        >
          {t("exercise.cognitive.doneSpeaking", "다 말했습니다")}
        </Button3D>
      </div>
    </div>
  );
}
