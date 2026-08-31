import type { SupportedLanguage } from "@/utils/localizedText";

const DAY_ONE_FILENAMES: Readonly<Record<string, string>> = {
  "day.1.greeting": "01_day_1_greeting.mp3",
  "exercise.D1_Q1.prompt": "02_exercise_d1_q1_prompt.mp3",
  "exercise.D1_Q1.option.A": "03_exercise_d1_q1_option_a.mp3",
  "exercise.D1_Q1.option.B": "04_exercise_d1_q1_option_b.mp3",
  "exercise.D1_Q1.option.C": "05_exercise_d1_q1_option_c.mp3",
  "exercise.D1_Q1.option.D": "06_exercise_d1_q1_option_d.mp3",
  "exercise.D1_Q2.prompt": "07_exercise_d1_q2_prompt.mp3",
  "exercise.D1_Q2.option.A": "08_exercise_d1_q2_option_a.mp3",
  "exercise.D1_Q2.option.B": "09_exercise_d1_q2_option_b.mp3",
  "exercise.D1_Q2.option.C": "10_exercise_d1_q2_option_c.mp3",
  "exercise.D1_Q2.option.D": "11_exercise_d1_q2_option_d.mp3",
  "exercise.D1_Q3.prompt": "12_exercise_d1_q3_prompt.mp3",
  "exercise.D1_Q3.option.A": "13_exercise_d1_q3_option_a.mp3",
  "exercise.D1_Q3.option.B": "14_exercise_d1_q3_option_b.mp3",
  "exercise.D1_Q3.option.C": "15_exercise_d1_q3_option_c.mp3",
  "exercise.D1_Q3.option.D": "16_exercise_d1_q3_option_d.mp3",
  "exercise.D1_Q4.prompt": "17_exercise_d1_q4_prompt.mp3",
  "exercise.D1_Q4.option.A": "18_exercise_d1_q4_option_a.mp3",
  "exercise.D1_Q4.option.B": "19_exercise_d1_q4_option_b.mp3",
  "exercise.D1_Q4.option.C": "20_exercise_d1_q4_option_c.mp3",
  "exercise.D1_Q4.option.D": "21_exercise_d1_q4_option_d.mp3",
  "exercise.D1_Q5.prompt": "22_exercise_d1_q5_prompt.mp3",
  "guide.voice_review": "23_guide_voice_review.mp3",
  "exercise.D1_Q6.sequence": "24_exercise_d1_q6_sequence.mp3",
  "exercise.D1_Q6.option.A": "25_exercise_d1_q6_option_a.mp3",
  "exercise.D1_Q6.option.B": "26_exercise_d1_q6_option_b.mp3",
  "exercise.D1_Q6.option.C": "27_exercise_d1_q6_option_c.mp3",
  "exercise.D1_Q6.option.D": "28_exercise_d1_q6_option_d.mp3",
  "feedback.saved": "29_feedback_saved.mp3",
  "feedback.try_again": "30_feedback_try_again.mp3",
  "day.1.completion": "31_day_1_completion.mp3",
};

let activeAudio: HTMLAudioElement | null = null;

export function getHaruDayOneNarrationUrl(
  language: SupportedLanguage,
  narrationId: string,
): string | null {
  if (language !== "ja") return null;
  const filename = DAY_ONE_FILENAMES[narrationId];
  return filename ? `/assets/audio/narration/ja/day1/${filename}` : null;
}

/**
 * Plays a selected Fish Audio file when it has been imported. Returning false
 * lets the caller keep the browser speech-synthesis fallback during the voice
 * selection phase or on a device that blocks static audio.
 */
export async function playHaruDayOneNarration(
  language: SupportedLanguage,
  narrationId: string,
): Promise<boolean> {
  const url = getHaruDayOneNarrationUrl(language, narrationId);
  if (!url || typeof window === "undefined" || typeof Audio === "undefined") return false;

  activeAudio?.pause();
  activeAudio = new Audio(url);
  activeAudio.preload = "auto";
  activeAudio.addEventListener("ended", () => {
    if (activeAudio?.src.endsWith(url)) activeAudio = null;
  }, { once: true });
  try {
    await activeAudio.play();
    return true;
  } catch {
    activeAudio = null;
    return false;
  }
}
