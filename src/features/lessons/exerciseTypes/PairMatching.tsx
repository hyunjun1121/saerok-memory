import React, { useState, useEffect } from "react";
import { twMerge } from "tailwind-merge";
import { Button3D } from "../../../components/Button3D";
import { useTranslation } from "react-i18next";
import { ExerciseState } from "./types";

interface Pair {
  id: string;
  left: string;
  right: string;
}

interface PairMatchingProps {
  prompt: string;
  pairs: Pair[];
  explanation?: string;
  onComplete: () => void;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

export function PairMatching({
  prompt,
  pairs,
  explanation,
  onComplete,
  setGlobalState,
  globalState,
}: PairMatchingProps) {
  const { t } = useTranslation();

  const [leftItems, setLeftItems] = useState<{ id: string; text: string }[]>([]);
  const [rightItems, setRightItems] = useState<{ id: string; text: string }[]>([]);

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [errorPair, setErrorPair] = useState<{ left: string; right: string } | null>(null);
  const [missCount, setMissCount] = useState(0);

  useEffect(() => {
    const lefts = pairs.map((p) => ({ id: p.id, text: p.left }));
    const rights = pairs.map((p) => ({ id: p.id, text: p.right }));
    setLeftItems(lefts.sort(() => Math.random() - 0.5));
    setRightItems(rights.sort(() => Math.random() - 0.5));
  }, [pairs]);

  useEffect(() => {
    if (selectedLeft && selectedRight) {
      if (selectedLeft === selectedRight) {
        setMatchedIds((prev) => [...prev, selectedLeft]);
        setSelectedLeft(null);
        setSelectedRight(null);

        if (matchedIds.length + 1 === pairs.length) {
          setGlobalState("answer_selected");
        }
      } else {
        setErrorPair({ left: selectedLeft, right: selectedRight });

        setTimeout(() => {
          setSelectedLeft(null);
          setSelectedRight(null);
          setErrorPair(null);
        }, 800);
      }
    }
  }, [selectedLeft, selectedRight, pairs.length, matchedIds.length, setGlobalState]);

  const handleCheck = () => {
    if (matchedIds.length === pairs.length) {
      setGlobalState("correct_feedback");
    } else {
      const newMissCount = missCount + 1;
      setMissCount(newMissCount);
      if (newMissCount === 1) {
        setGlobalState("hint_feedback");
      } else {
        setGlobalState("incorrect_feedback");
      }
    }
  };

  const getCardStyle = (id: string, side: "left" | "right") => {
    const isMatched = matchedIds.includes(id);
    const isSelected = side === "left" ? selectedLeft === id : selectedRight === id;
    const isError = errorPair && (side === "left" ? errorPair.left === id : errorPair.right === id);

    if (isMatched) return "bg-primary-50 border-primary-200 text-primary-400 opacity-50 cursor-default scale-[0.98] shadow-none";
    if (isError) return "bg-red-50 border-red-500 text-red-800 animate-[shake_0.4s_ease-in-out]";
    if (isSelected) return "bg-blue-50 border-blue-500 text-ink scale-[1.02] ring-2 ring-blue-200 ring-offset-1";

    return "bg-white border-gray-300 text-ink hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-card";
  };

  return (
    <div className="flex flex-col w-full gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-orange-500 uppercase tracking-wide">
          {t("exercise.pairMatching.prompt")}
        </span>
        <h2 className="text-3xl font-extrabold text-ink leading-snug">{prompt}</h2>
      </div>

      <div className="flex w-full gap-4">
        <div className="flex flex-col gap-3 flex-1">
          {leftItems.map((item) => (
            <button
              key={`l-${item.id}`}
              disabled={matchedIds.includes(item.id) || !!errorPair}
              onClick={() => setSelectedLeft(item.id === selectedLeft ? null : item.id)}
              className={twMerge(
                "relative flex items-center justify-center min-h-[72px] p-3 rounded-2xl border-2 transition-all font-bold text-lg select-none",
                getCardStyle(item.id, "left")
              )}
            >
              {item.text}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 flex-1">
          {rightItems.map((item) => (
            <button
              key={`r-${item.id}`}
              disabled={matchedIds.includes(item.id) || !!errorPair}
              onClick={() => setSelectedRight(item.id === selectedRight ? null : item.id)}
              className={twMerge(
                "relative flex items-center justify-center min-h-[72px] p-3 rounded-2xl border-2 transition-all font-bold text-lg text-center select-none",
                getCardStyle(item.id, "right")
              )}
            >
              {item.text}
            </button>
          ))}
        </div>
      </div>

      {(globalState === "awaiting_answer" || globalState === "answer_selected") && (
        <div className="fixed bottom-[96px] left-0 right-0 px-4 max-w-md mx-auto z-30">
          <Button3D
            variant={globalState === "answer_selected" ? "primary" : "disabled"}
            fullWidth
            onClick={handleCheck}
          >
            확인하기
          </Button3D>
        </div>
      )}
    </div>
  );
}
