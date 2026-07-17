import { readFile } from "node:fs/promises";
import { isDeepStrictEqual, inspect } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(repoRoot, "haru_7day_admin_usage_records.json");
const failures = [];

function printable(value) {
  return inspect(value, { depth: 8, breakLength: 120, sorted: true });
}

function checkEqual(label, actual, expected) {
  if (!isDeepStrictEqual(actual, expected)) {
    failures.push(`${label}\n  expected: ${printable(expected)}\n  actual:   ${printable(actual)}`);
  }
}

function check(condition, label, detail) {
  if (!condition) {
    failures.push(detail === undefined ? label : `${label}\n  ${detail}`);
  }
}

function korean(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.ko === "string") return value.ko;
  return value;
}

function normalizedCorrectAnswer(question) {
  if (!question.correct_answer) return null;
  if (typeof question.correct_answer.button === "string") return question.correct_answer.button;
  if (Array.isArray(question.correct_answer.sequence)) return question.correct_answer.sequence;
  return undefined;
}

function normalizedCorrectLabels(question) {
  if (!question.correct_answer) return null;
  if (typeof question.correct_answer.label === "string") return [question.correct_answer.label];
  if (Array.isArray(question.correct_answer.labels)) return question.correct_answer.labels;
  return undefined;
}

function findAliasedValue(object, aliases) {
  if (!object || typeof object !== "object") return { found: false, value: undefined };
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(object, alias)) {
      return { found: true, value: object[alias] };
    }
  }
  return { found: false, value: undefined };
}

function compareAliasedFields(label, actual, expected, aliasesByExpectedKey) {
  check(actual && typeof actual === "object", `${label} must be an object`, `actual: ${printable(actual)}`);
  if (!actual || typeof actual !== "object") return;

  for (const [expectedKey, expectedValue] of Object.entries(expected)) {
    const aliases = aliasesByExpectedKey[expectedKey] ?? [expectedKey];
    const result = findAliasedValue(actual, aliases);
    check(result.found, `${label}.${expectedKey} is missing`, `accepted keys: ${aliases.join(", ")}`);
    if (result.found) checkEqual(`${label}.${expectedKey}`, korean(result.value), expectedValue);
  }
}

const forbiddenKeyNames = new Set([
  "rawtranscript",
  "rawuserutterancetranscript",
  "audiostorage",
  "objectkey",
  "buttonevent",
  "buttonevents",
]);

function checkNoForbiddenKeys(value, path = "clientScenarioPayload", seen = new WeakSet()) {
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => checkNoForbiddenKeys(item, `${path}[${index}]`, seen));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (forbiddenKeyNames.has(normalizedKey)) {
      failures.push(`${path}.${key} exposes forbidden private event/transcript data`);
    }
    checkNoForbiddenKeys(nestedValue, `${path}.${key}`, seen);
  }
}

let vite;

try {
  const source = JSON.parse(await readFile(sourcePath, "utf8"));

  vite = await createServer({
    root: repoRoot,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false },
  });

  const haruModule = await vite.ssrLoadModule("/src/data/haru7DayExercises.ts");
  const counselorModule = await vite.ssrLoadModule(
    "/src/app/connect/counselor/counselorData.ts",
  );

  const sessions = source.sessions;
  const plans = haruModule.HARU_WEEK_PLAN;
  const exercises = haruModule.haru7DayExercises;
  const metadata = haruModule.HARU_WEEK_QUESTION_META;
  const persona = haruModule.HARU_DEMO_PERSONA;

  check(Array.isArray(sessions), "source.sessions must be an array");
  check(Array.isArray(plans), "HARU_WEEK_PLAN must be an array");
  check(Array.isArray(exercises), "haru7DayExercises must be an array");
  check(Array.isArray(metadata), "HARU_WEEK_QUESTION_META must be an array");

  if (Array.isArray(sessions) && Array.isArray(plans) && Array.isArray(exercises) && Array.isArray(metadata)) {
    checkEqual("session count", sessions.length, 7);
    checkEqual("week-plan count", plans.length, 7);

    const sourceQuestionCount = sessions.reduce(
      (total, session) => total + (session.question_records?.length ?? 0),
      0,
    );
    checkEqual("source question count", sourceQuestionCount, 42);
    checkEqual("exercise count", exercises.length, 42);
    checkEqual("question metadata count", metadata.length, 42);

    const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    const metadataById = new Map(metadata.map((item) => [item.exerciseId, item]));
    const sourceIds = [];
    const planIds = [];

    sessions.forEach((session, sessionIndex) => {
      const day = sessionIndex + 1;
      const plan = plans[sessionIndex];
      const records = session.question_records ?? [];
      const dayLabel = `day ${day}`;

      check(plan, `${dayLabel} plan is missing`);
      if (!plan) return;

      checkEqual(`${dayLabel} plan.day`, plan.day, day);
      checkEqual(`${dayLabel} date`, plan.dateISO, session.session_date);
      checkEqual(`${dayLabel} weekday`, korean(plan.weekday), session.weekday);
      checkEqual(
        `${dayLabel} completion message`,
        korean(plan.completionMessage),
        session.session_summary?.completion_message,
      );
      checkEqual(`${dayLabel} source completion status`, session.completion_status, "completed");
      checkEqual(`${dayLabel} source question_count`, session.question_count, records.length);
      checkEqual(`${dayLabel} question count`, records.length, 6);

      const daySourceIds = records.map((record) => record.question?.question_id);
      sourceIds.push(...daySourceIds);
      planIds.push(...plan.exerciseIds);
      checkEqual(`${dayLabel} IDs and order`, [...plan.exerciseIds], daySourceIds);

      records.forEach((record, recordIndex) => {
        const question = record.question;
        const id = question?.question_id ?? `${dayLabel} question ${recordIndex + 1}`;
        const label = `${id}`;
        const exercise = exerciseById.get(question?.question_id);
        const meta = metadataById.get(question?.question_id);

        check(exercise, `${label} exercise is missing`);
        check(meta, `${label} metadata is missing`);
        if (!exercise || !meta || !question) return;

        checkEqual(`${label} day`, meta.day, day);
        checkEqual(`${label} order`, meta.order, question.order);
        checkEqual(`${label} prompt.ko`, korean(exercise.prompt), question.prompt_text);
        checkEqual(`${label} audioText.ko`, korean(exercise.payload?.audioText), question.prompt_audio_text);

        const sourceOptions = (question.choices ?? []).map((choice) => ({
          id: choice.button,
          label: choice.label,
        }));
        const exerciseOptions = (exercise.payload?.options ?? exercise.payload?.items ?? []).map(
          (choice) => ({ id: choice.id, label: korean(choice.label) }),
        );
        checkEqual(`${label} ordered options`, exerciseOptions, sourceOptions);

        const expectedCorrectAnswer = normalizedCorrectAnswer(question);
        check(
          expectedCorrectAnswer !== undefined,
          `${label} source correct_answer has unsupported shape`,
          printable(question.correct_answer),
        );
        checkEqual(`${label} correct answer IDs`, exercise.correctAnswer, expectedCorrectAnswer);

        const expectedCorrectLabels = normalizedCorrectLabels(question);
        check(
          expectedCorrectLabels !== undefined,
          `${label} source correct-answer labels have unsupported shape`,
          printable(question.correct_answer),
        );
        if (expectedCorrectLabels !== undefined && expectedCorrectLabels !== null) {
          const correctIds = Array.isArray(exercise.correctAnswer)
            ? exercise.correctAnswer
            : [exercise.correctAnswer];
          const labelsById = new Map(exerciseOptions.map((option) => [option.id, option.label]));
          checkEqual(
            `${label} correct answer labels`,
            correctIds.map((correctId) => labelsById.get(correctId)),
            expectedCorrectLabels,
          );
        }

        checkEqual(`${label} responseType`, meta.responseType, question.response_type);
        checkEqual(`${label} scored`, meta.scored, question.scored);
        checkEqual(
          `${label} maxResponseSeconds`,
          meta.maxResponseSeconds ?? null,
          question.max_response_seconds ?? null,
        );
        checkEqual(
          `${label} personalizationSourceNote`,
          korean(meta.personalizationSourceNote) ?? null,
          question.personalization_source_note ?? null,
        );

        const recorded = meta.recordedResponse;
        check(recorded && typeof recorded === "object", `${label} recordedResponse is missing`);
        if (!recorded || typeof recorded !== "object") return;

        for (const key of ["isCorrect", "feedback", "responseTimeMs"]) {
          check(
            Object.prototype.hasOwnProperty.call(recorded, key),
            `${label} recordedResponse.${key} is missing`,
          );
        }

        checkEqual(
          `${label} recorded selected option`,
          recorded.selectedOptionId ?? null,
          record.response?.selected_choice?.button ?? null,
        );
        checkEqual(
          `${label} recorded submitted sequence`,
          recorded.submittedSequence ?? null,
          record.response?.submitted_sequence ?? null,
        );
        checkEqual(
          `${label} recorded isCorrect`,
          recorded.isCorrect ?? null,
          record.response?.evaluation?.is_correct ?? null,
        );
        checkEqual(
          `${label} recorded feedback`,
          korean(recorded.feedback),
          record.system_feedback?.feedback_text,
        );
        checkEqual(
          `${label} recorded responseTimeMs`,
          recorded.responseTimeMs,
          record.response?.response_time_ms,
        );
        checkEqual(
          `${label} recorded voiceDurationSeconds`,
          recorded.voiceDurationSeconds ?? null,
          record.response?.audio_duration_seconds ?? null,
        );
        checkEqual(
          `${label} recorded sttStatus`,
          recorded.sttStatus ?? null,
          record.response?.stt?.status ?? null,
        );
        checkEqual(
          `${label} recorded sttConfidence`,
          recorded.sttConfidence ?? null,
          record.response?.stt?.confidence ?? null,
        );
      });
    });

    checkEqual("all source IDs and plan order", planIds, sourceIds);
    checkEqual("unique source question IDs", new Set(sourceIds).size, 42);
    checkEqual("unique exercise IDs", new Set(exercises.map((exercise) => exercise.id)).size, 42);
    checkEqual("unique metadata IDs", new Set(metadata.map((item) => item.exerciseId)).size, 42);
  }

  const profileAliases = {
    "고향": ["고향", "hometown"],
    "졸업학교": ["졸업학교", "elementarySchool", "graduatedSchool", "school"],
    "과거직업": ["과거직업", "formerOccupation"],
    "딸": ["딸", "daughterName", "daughter"],
    "손자": ["손자", "grandsonName", "grandson"],
    "가까운친구": ["가까운친구", "closeFriendName", "closeFriend"],
    "이웃": ["이웃", "neighborName", "neighbor"],
    "좋아하는음식": ["좋아하는음식", "favoriteFood"],
    "복약시간": ["복약시간", "medicationTime"],
  };
  compareAliasedFields(
    "HARU_DEMO_PERSONA.registeredProfileFields",
    persona?.registeredProfileFields ?? persona?.registered_profile_fields,
    source.user?.registered_profile_fields ?? {},
    profileAliases,
  );

  const consentAliases = {
    voice_recording: ["voice_recording", "voiceRecording"],
    stt_processing: ["stt_processing", "sttProcessing"],
    longitudinal_usage_storage: ["longitudinal_usage_storage", "longitudinalUsageStorage"],
    personalized_question_use: ["personalized_question_use", "personalizedQuestionUse"],
  };
  const expectedConsents = Object.fromEntries(
    Object.keys(consentAliases).map((key) => [key, source.user?.consents?.[key]]),
  );
  compareAliasedFields(
    "HARU_DEMO_PERSONA.consents",
    persona?.consents,
    expectedConsents,
    consentAliases,
  );

  const derivedAggregate = {
    completedSessions: (source.sessions ?? []).filter(
      (session) => session.completion_status === "completed",
    ).length,
    activityCount: (source.sessions ?? []).reduce(
      (total, session) => total + (session.question_records?.length ?? 0),
      0,
    ),
    evaluatedActivities: (source.sessions ?? []).reduce(
      (total, session) =>
        total +
        (session.question_records ?? []).filter(
          (record) => typeof record.response?.evaluation?.is_correct === "boolean",
        ).length,
      0,
    ),
    expectedMatches: (source.sessions ?? []).reduce(
      (total, session) =>
        total +
        (session.question_records ?? []).filter(
          (record) => record.response?.evaluation?.is_correct === true,
        ).length,
      0,
    ),
    voiceRecords: (source.sessions ?? []).reduce(
      (total, session) =>
        total +
        (session.question_records ?? []).filter(
          (record) => record.question?.response_type === "voice",
        ).length,
      0,
    ),
  };
  checkEqual("source counselor aggregate", derivedAggregate, {
    completedSessions: 7,
    activityCount: 42,
    evaluatedActivities: 28,
    expectedMatches: 27,
    voiceRecords: 7,
  });

  const liveSessions = (source.sessions ?? []).map((session, index) => ({
    day: index + 1,
    status: session.completion_status,
    startedAt: session.session_started_at,
    completedAt: session.session_completed_at,
    completionMessage: session.session_summary?.completion_message,
    durationSeconds: session.session_summary?.duration_seconds,
    questionIds: (session.question_records ?? []).map(
      (record) => record.question?.question_id,
    ),
    responses: (session.question_records ?? []).map((record) => ({
      questionId: record.question?.question_id,
      responseType: record.question?.response_type,
      selectedOptionId: record.response?.selected_choice?.button,
      submittedSequence: record.response?.submitted_sequence,
      responseTimeMs: record.response?.response_time_ms,
      isCorrect: record.response?.evaluation?.is_correct ?? null,
      feedback: record.system_feedback?.feedback_text,
      voiceDurationSeconds: record.response?.audio_duration_seconds,
      sttStatus: record.response?.stt?.status,
      sttConfidence: record.response?.stt?.confidence,
    })),
  }));
  const participant = counselorModule.buildHaruParticipant(liveSessions);
  check(participant, "counselor participant for source persona is missing");
  if (participant) {
    for (const [key, expectedValue] of Object.entries(derivedAggregate)) {
      checkEqual(`counselor participant ${key}`, participant[key], expectedValue);
    }
  }

  checkNoForbiddenKeys({
    HARU_DEMO_PERSONA: persona,
    HARU_WEEK_PLAN: plans,
    HARU_WEEK_QUESTION_META: metadata,
    haru7DayExercises: exercises,
    liveParticipant: participant,
  });
} catch (error) {
  failures.push(`checker crashed\n  ${error instanceof Error ? error.stack : printable(error)}`);
} finally {
  await vite?.close();
}

if (failures.length > 0) {
  console.error(`Haru 7-day contract FAILED (${failures.length} issue${failures.length === 1 ? "" : "s"})`);
  failures.forEach((failure, index) => console.error(`\n${index + 1}. ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Haru 7-day contract OK: 7 sessions, 42 questions, persona consent, counselor aggregate, privacy scan.");
}
