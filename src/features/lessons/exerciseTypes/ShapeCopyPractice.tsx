import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button3D } from "../../../components/Button3D";
import type { ExerciseState } from "./types";
import { saveCognitiveRoutineResult } from "../../cognitive/cognitiveRoutineStorage";

interface ShapeCopyPracticeProps {
  prompt: string;
  onComplete: () => void;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

export function ShapeCopyPractice({
  prompt,
  onComplete,
  setGlobalState,
  globalState,
}: ShapeCopyPracticeProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    // Basic setup to ensure the canvas is interactable, avoiding strict completion blocks
    if (globalState === "awaiting_answer" || globalState === "answer_selected") {
      setGlobalState("answer_selected"); // Just immediately enable check button for flexibility
    }
  }, [globalState, setGlobalState]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#2b2f33"; // text-ink
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleCheck = () => {
    let dataUrl = undefined;
    if (canvasRef.current && hasDrawn) {
        dataUrl = canvasRef.current.toDataURL("image/png");
    }

    saveCognitiveRoutineResult({
      type: "shape_copy_practice",
      completed: true,
      metadata: { hasDrawn, dataUrl }
    });

    setGlobalState("correct_feedback");
    onComplete(); // Skip feedback tray for this one since it's just completion
  };

  return (
    <div className="flex flex-col w-full gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-blue-500 uppercase tracking-wide">
          {t("exercise.cognitive.practice", "그리기 연습")}
        </span>
        <h2 className="text-3xl font-extrabold text-ink leading-snug">{prompt}</h2>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 py-4">
        {/* Simple non-diagnostic house shape reference */}
        <div className="w-32 h-32 border-4 border-gray-400 rounded-lg flex items-center justify-center relative bg-gray-50">
            <svg viewBox="0 0 100 100" className="w-24 h-24 stroke-gray-600 fill-none stroke-[4] stroke-linecap-round stroke-linejoin-round">
                <path d="M 20 50 L 50 20 L 80 50 L 80 80 L 20 80 Z M 20 50 L 80 50" />
            </svg>
        </div>
      </div>

      <div className="flex flex-col gap-2 relative">
          <canvas
            ref={canvasRef}
            width={300}
            height={200}
            className="w-full h-[200px] bg-white border-2 border-gray-300 rounded-2xl touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            onTouchCancel={stopDrawing}
            style={{ cursor: "crosshair" }}
            aria-label="Drawing area"
          />
          <button
            onClick={handleClear}
            className="self-end text-gray-500 font-semibold px-4 py-2 hover:bg-gray-100 rounded-xl"
          >
              {t("exercise.cognitive.clear", "지우기")}
          </button>
      </div>

      <div className="fixed bottom-[96px] left-0 right-0 px-4 max-w-md mx-auto z-30">
        <Button3D
          variant={hasDrawn ? "primary" : "neutral"}
          fullWidth
          onClick={handleCheck}
        >
          {t("exercise.cognitive.done", "다 그렸습니다")}
        </Button3D>
      </div>
    </div>
  );
}
