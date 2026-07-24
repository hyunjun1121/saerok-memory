import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { Button3D } from "@/components/Button3D";
import { ScenarioCard } from "@/features/lessons/ui/ScenarioCard";
import { saveCognitiveRoutineResult } from "@/features/cognitive/cognitiveRoutineStorage";
import { useInteractionFeedback } from "@/hooks/useInteractionFeedback";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";

export interface RenderedTrailNode {
  id: string;
  label: string;
  group: "number" | "symbol";
  x: number;
  y: number;
}

interface TrailSwitchingPracticeProps {
  prompt: string;
  nodes: RenderedTrailNode[];
  expectedTrail: string[];
  scenarioTitle?: string;
  scenarioBody?: string;
  benefitCopy?: string;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

function isFinishedState(state: ExerciseState) {
  return state === "correct_feedback" || state === "incorrect_feedback" || state === "completed";
}

function getCurrentTimestampMs() {
  return Date.now();
}

export function TrailSwitchingPractice({
  prompt,
  nodes,
  expectedTrail,
  scenarioTitle,
  scenarioBody,
  benefitCopy,
  setGlobalState,
  globalState,
}: TrailSwitchingPracticeProps) {
  const { t } = useTranslation();
  const { playCue } = useInteractionFeedback();
  const startedAtRef = useRef(0);
  const [clickedNodeIds, setClickedNodeIds] = useState<string[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [lastWrongLabel, setLastWrongLabel] = useState<string | null>(null);

  const nodesById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const expectedNodes = expectedTrail
    .map((nodeId) => nodesById.get(nodeId))
    .filter((node): node is RenderedTrailNode => Boolean(node));
  const currentExpectedId = expectedTrail[clickedNodeIds.length];
  const currentExpectedNode = currentExpectedId ? nodesById.get(currentExpectedId) : undefined;
  const completed = clickedNodeIds.length === expectedTrail.length;

  useEffect(() => {
    startedAtRef.current = getCurrentTimestampMs();
  }, []);

  const resetTrail = () => {
    startedAtRef.current = getCurrentTimestampMs();
    setClickedNodeIds([]);
    setErrorCount(0);
    setLastWrongLabel(null);
    setGlobalState("awaiting_answer");
  };

  const handleNodeClick = (node: RenderedTrailNode) => {
    if (isFinishedState(globalState) || completed || !currentExpectedId) {
      return;
    }

    void playCue("select");

    if (node.id !== currentExpectedId) {
      setErrorCount((current) => current + 1);
      setLastWrongLabel(node.label);
      setGlobalState("awaiting_answer");
      return;
    }

    setLastWrongLabel(null);
    const nextClickedNodeIds = [...clickedNodeIds, node.id];
    setClickedNodeIds(nextClickedNodeIds);

    if (nextClickedNodeIds.length === expectedTrail.length) {
      const elapsedMs = getCurrentTimestampMs() - startedAtRef.current;
      saveCognitiveRoutineResult({
        type: "trail_switching_practice",
        completed: true,
        metadata: {
          expectedTrail,
          clickedNodeIds: nextClickedNodeIds,
          errorCount,
          elapsedMs,
          nodeCount: expectedTrail.length,
        },
      });
      setGlobalState("correct_feedback");
    } else {
      setGlobalState("answer_selected");
    }
  };

  const completedPointIds = new Set(clickedNodeIds);
  const linePoints = expectedNodes
    .slice(0, clickedNodeIds.length)
    .map((node) => `${node.x},${node.y}`)
    .join(" ");

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold uppercase tracking-wide text-primary-600">
          {t("exercise.cognitive.trailSwitching")}
        </span>
        <h2 className="text-3xl font-extrabold leading-snug text-ink">{prompt}</h2>
      </div>

      <ScenarioCard title={scenarioTitle} body={scenarioBody} benefit={benefitCopy} />

      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-sm">
        <svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {linePoints && (
            <polyline
              points={linePoints}
              fill="none"
              stroke="var(--color-primary-500)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
          )}
        </svg>

        {nodes.map((node) => {
          const isDone = completedPointIds.has(node.id);
          const isCurrent = node.id === currentExpectedId;

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => handleNodeClick(node)}
              aria-label={t("exercise.cognitive.trailNodeAria", { label: node.label })}
              aria-current={isCurrent ? "true" : undefined}
              className={[
                "absolute flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border-[4px] px-2 text-center text-3xl font-extrabold leading-tight shadow-md transition active:scale-95",
                node.group === "number"
                  ? "rounded-xl border-ink bg-[var(--color-surface-warm)] text-ink"
                  : "rounded-full border-orange-500 bg-amber-50 text-ink",
                isCurrent ? "ring-8 ring-primary-300" : "",
                isDone ? "border-primary-500 bg-primary-500 text-white" : "",
              ].join(" ")}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              <span className="leading-tight">{node.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border-2 border-gray-200 bg-white p-4">
          <p className="text-sm font-bold text-gray-500">
            {t("exercise.cognitive.trailCurrentTarget")}
          </p>
          <p className="text-2xl font-extrabold text-ink">
            {currentExpectedNode?.label ?? t("exercise.cognitive.done")}
          </p>
        </div>
        <div className="rounded-2xl border-2 border-gray-200 bg-white p-4">
          <p className="text-sm font-bold text-gray-500">
            {t("exercise.cognitive.trailErrors")}
          </p>
          <p className="text-2xl font-extrabold text-ink">{errorCount}</p>
        </div>
      </div>

      {lastWrongLabel && (
        <p className="rounded-2xl border-2 border-yellow-100 bg-yellow-50 px-4 py-3 text-sm font-bold leading-relaxed text-yellow-900">
          {t("exercise.cognitive.trailWrongNode", { label: lastWrongLabel })}
        </p>
      )}

      <div className="mt-1">
        <Button3D variant="neutral" fullWidth onClick={resetTrail}>
          <RotateCcw className="mr-2 h-5 w-5" />
          {t("exercise.cognitive.restartTrail")}
        </Button3D>
      </div>
    </div>
  );
}
