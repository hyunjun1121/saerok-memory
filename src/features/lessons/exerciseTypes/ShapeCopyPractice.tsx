import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button3D } from "@/components/Button3D";
import { saveCognitiveRoutineResult } from "@/features/cognitive/cognitiveRoutineStorage";
import { captureHaruTelemetry } from "@/features/analytics/client";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";

interface DrawingPoint {
  x: number;
  y: number;
  t: number;
  stroke: number;
  event: "start" | "move";
}

interface ShapeCopyPracticeProps {
  prompt: string;
  onComplete: () => void;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

const MAX_STORED_POINTS = 160;
const HESITATION_THRESHOLD_MS = 900;

function getCurrentTimestampMs() {
  return Date.now();
}

function getDrawingPointFromEvent(
  e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  rect: DOMRect,
  timestamp: number,
  stroke: number,
  event: DrawingPoint["event"],
): DrawingPoint | null {
  if ("touches" in e) {
    const touch = e.touches[0] ?? e.changedTouches[0];
    if (!touch) {
      return null;
    }

    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
      t: timestamp,
      stroke,
      event,
    };
  }

  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    t: timestamp,
    stroke,
    event,
  };
}

function calculateDistance(a: DrawingPoint, b: DrawingPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
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
  const exerciseStartedAtRef = useRef(0);
  const firstDrawAtRef = useRef<number | null>(null);
  const lastPointRef = useRef<DrawingPoint | null>(null);
  const pointsRef = useRef<DrawingPoint[]>([]);
  const strokeCountRef = useRef(0);
  const clearCountRef = useRef(0);
  const hesitationCountRef = useRef(0);
  const pathLengthRef = useRef(0);

  useEffect(() => {
    exerciseStartedAtRef.current = getCurrentTimestampMs();
  }, []);

  useEffect(() => {
    if (globalState === "awaiting_answer" || globalState === "answer_selected") {
      setGlobalState("answer_selected");
    }
  }, [globalState, setGlobalState]);

  const appendPoint = (point: DrawingPoint) => {
    const previous = lastPointRef.current;

    if (previous && previous.stroke === point.stroke && point.event === "move") {
      pathLengthRef.current += calculateDistance(previous, point);

      if (point.t - previous.t > HESITATION_THRESHOLD_MS) {
        hesitationCountRef.current += 1;
      }
    }

    lastPointRef.current = point;

    if (pointsRef.current.length < MAX_STORED_POINTS) {
      pointsRef.current.push(point);
      return;
    }

    const lastStoredPoint = pointsRef.current[pointsRef.current.length - 1];
    const enoughTimePassed = point.t - lastStoredPoint.t > 120;

    if (enoughTimePassed || point.event === "start") {
      pointsRef.current[pointsRef.current.length - 1] = point;
    }
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const timestamp = getCurrentTimestampMs();
    const stroke = strokeCountRef.current + 1;
    const point = getDrawingPointFromEvent(e, rect, timestamp, stroke, "start");
    if (!point) return;

    if (firstDrawAtRef.current === null) {
      firstDrawAtRef.current = timestamp;
      void captureHaruTelemetry("drawing_progress", {
        phase: "started",
        strokeCount: 1,
        pointCount: 1,
        pauseCount: 0,
        eraseCount: clearCountRef.current,
        durationMs: 0,
      });
    }

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    strokeCountRef.current = stroke;
    appendPoint(point);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const timestamp = getCurrentTimestampMs();
    const point = getDrawingPointFromEvent(e, rect, timestamp, strokeCountRef.current, "move");
    if (!point) return;

    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#2b2f33";
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    appendPoint(point);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const firstPoint = pointsRef.current[0];
    const lastPoint = pointsRef.current[pointsRef.current.length - 1];
    void captureHaruTelemetry("drawing_progress", {
      phase: "cleared",
      strokeCount: strokeCountRef.current,
      pointCount: pointsRef.current.length,
      pauseCount: hesitationCountRef.current,
      eraseCount: clearCountRef.current + 1,
      durationMs:
        firstPoint && lastPoint ? Math.max(0, lastPoint.t - firstPoint.t) : 0,
    });
    clearCountRef.current += 1;
    pointsRef.current = [];
    strokeCountRef.current = 0;
    hesitationCountRef.current = 0;
    pathLengthRef.current = 0;
    lastPointRef.current = null;
    setHasDrawn(false);
  };

  const handleCheck = () => {
    let dataUrl: string | undefined;
    if (canvasRef.current && hasDrawn) {
      dataUrl = canvasRef.current.toDataURL("image/png");
    }

    const firstPoint = pointsRef.current[0];
    const lastPoint = pointsRef.current[pointsRef.current.length - 1];
    const firstTouchLatencyMs =
      firstDrawAtRef.current !== null && exerciseStartedAtRef.current > 0
        ? firstDrawAtRef.current - exerciseStartedAtRef.current
        : null;
    const drawingDurationMs =
      firstPoint && lastPoint ? Math.max(0, lastPoint.t - firstPoint.t) : 0;
    const sampledPath = pointsRef.current.map((point) => ({
      x: Math.round(point.x),
      y: Math.round(point.y),
      timeOffsetMs: firstPoint ? point.t - firstPoint.t : 0,
      stroke: point.stroke,
      event: point.event,
    }));

    saveCognitiveRoutineResult({
      type: "shape_copy_practice",
      completed: hasDrawn,
      metadata: {
        hasDrawn,
        dataUrl,
        template: "simple_house_copy",
        strokeCount: strokeCountRef.current,
        sampledPointCount: sampledPath.length,
        drawingDurationMs,
        firstTouchLatencyMs,
        hesitationCount: hesitationCountRef.current,
        clearCount: clearCountRef.current,
        pathLengthPx: Math.round(pathLengthRef.current),
        sampledPath,
      },
    });

    void captureHaruTelemetry("drawing_progress", {
      phase: "completed",
      strokeCount: strokeCountRef.current,
      pointCount: sampledPath.length,
      pauseCount: hesitationCountRef.current,
      eraseCount: clearCountRef.current,
      durationMs: drawingDurationMs,
    });

    setGlobalState("correct_feedback");
    onComplete();
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold uppercase tracking-wide text-blue-500">
          {t("exercise.cognitive.practice", "Practice")}
        </span>
        <h2 className="text-3xl font-extrabold leading-snug text-ink">{prompt}</h2>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 py-4">
        <div className="relative flex h-48 w-48 items-center justify-center rounded-xl border-4 border-gray-400 bg-gray-50">
          <svg
            viewBox="0 0 100 100"
            className="h-40 w-40 fill-none stroke-gray-600 stroke-[4] [stroke-linecap:round] [stroke-linejoin:round]"
            aria-hidden="true"
          >
            <path d="M 20 50 L 50 20 L 80 50 L 80 80 L 20 80 Z M 20 50 L 80 50" />
          </svg>
        </div>
      </div>

      <div className="relative flex flex-col gap-2">
        <canvas
          ref={canvasRef}
          width={540}
          height={380}
          className="h-[380px] w-full touch-none rounded-2xl border-2 border-gray-300 bg-white"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
          style={{ cursor: "crosshair" }}
          aria-label={t("exercise.cognitive.drawingArea")}
        />
        <button
          type="button"
          onClick={handleClear}
          className="self-end rounded-xl px-4 py-2 font-semibold text-gray-500 hover:bg-gray-100"
        >
          {t("exercise.cognitive.clear", "Clear")}
        </button>
      </div>

      <div className="mt-1">
        <Button3D variant={hasDrawn ? "primary" : "neutral"} fullWidth onClick={handleCheck}>
          {t("exercise.cognitive.done", "Done")}
        </Button3D>
      </div>
    </div>
  );
}
