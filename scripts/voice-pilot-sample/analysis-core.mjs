const ASSIST_PREPROCESSING_VERSION = "haru-dc-hp80-rms-v2";
const BASELINE_PREPROCESSING_FALLBACK = "decode-resample-only-v1";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function finite(value) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function nonNegative(value, fallback = 0) {
  const number = finite(value);
  return number === null ? fallback : Math.max(0, number);
}

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

function average(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

export function quantile(values, percentile) {
  const usable = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (!usable.length) return null;
  if (usable.length === 1) return usable[0];
  const bounded = Math.min(1, Math.max(0, percentile));
  const index = (usable.length - 1) * bounded;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return usable[lower];
  return usable[lower] + (usable[upper] - usable[lower]) * (index - lower);
}

export function editDistance(reference, hypothesis) {
  const left = Array.from(reference ?? []);
  const right = Array.from(hypothesis ?? []);
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function normalizedText(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase("und").trim();
}

function characterUnits(value) {
  return Array.from(normalizedText(value).replace(/[\p{P}\p{S}\s]+/gu, ""));
}

function wordUnits(value) {
  const normalized = normalizedText(value)
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized ? normalized.split(" ") : [];
}

export function characterErrorRate(reference, hypothesis) {
  const referenceUnits = characterUnits(reference);
  const hypothesisUnits = characterUnits(hypothesis);
  if (!referenceUnits.length) return hypothesisUnits.length ? null : 0;
  return editDistance(referenceUnits, hypothesisUnits) / referenceUnits.length;
}

export function wordErrorRate(reference, hypothesis) {
  const referenceUnits = wordUnits(reference);
  const hypothesisUnits = wordUnits(hypothesis);
  if (!referenceUnits.length) return hypothesisUnits.length ? null : 0;
  return editDistance(referenceUnits, hypothesisUnits) / referenceUnits.length;
}

function rowStatus(row) {
  if (row.noSpeech === true) return "no_speech";
  return String(row.status ?? row.sttStatus ?? "unknown").toLocaleLowerCase("en-US").replaceAll("-", "_");
}

function isNoSpeech(row) {
  return row.noSpeech === true || rowStatus(row) === "no_speech";
}

function usableTranscript(row) {
  return row.usableTranscript === true || row.humanUsable === true || row.review?.humanUsable === true;
}

function droppedAtVoiceStep(row) {
  const status = rowStatus(row);
  return (
    row.droppedAtVoiceStep === true ||
    row.dropout === true ||
    ["abandoned", "cancelled", "dropped", "dropout"].includes(status)
  );
}

function variantKind(value) {
  const variant = String(value ?? "unknown").toLocaleLowerCase("en-US");
  if (variant.includes("assist")) return "assist";
  if (variant.includes("baseline") || variant.includes("raw")) return "baseline";
  return variant;
}

function slotOutcome(row) {
  const explicitSlots = array(row.semanticSlots ?? row.review?.semanticSlots);
  const hypothesis = normalizedText(row.hypothesisTranscript);
  if (explicitSlots.length) {
    let preserved = 0;
    for (const slot of explicitSlots) {
      if (!isRecord(slot)) continue;
      const expectedValues = array(slot.expectedValues ?? slot.expected).map(normalizedText).filter(Boolean);
      const didPreserve =
        typeof slot.preserved === "boolean"
          ? slot.preserved
          : expectedValues.some((expected) => hypothesis.includes(expected));
      if (didPreserve) preserved += 1;
    }
    return { preserved, total: explicitSlots.length, source: "explicit_review_slots" };
  }

  const suppliedTotal = finite(row.semanticSlotCount);
  const suppliedPreserved = finite(row.preservedSlotCount);
  if (suppliedTotal !== null && suppliedPreserved !== null && suppliedTotal >= 0) {
    return {
      preserved: Math.min(suppliedTotal, Math.max(0, suppliedPreserved)),
      total: suppliedTotal,
      source: "supplied_counts",
    };
  }

  // Restricted-review fallback only. Whitespace tokens are a lexical proxy,
  // not a semantic model; reports expose this limitation.
  const referenceTokens = wordUnits(row.referenceTranscript);
  const hypothesisTokens = new Set(wordUnits(row.hypothesisTranscript));
  return {
    preserved: referenceTokens.filter((token) => hypothesisTokens.has(token)).length,
    total: referenceTokens.length,
    source: "lexical_token_proxy",
  };
}

function aggregateEditMetric(rows, unitizer, suppliedField) {
  let edits = 0;
  let referenceLength = 0;
  const supplied = [];
  for (const row of rows) {
    const reference = unitizer(row.referenceTranscript);
    const hypothesis = unitizer(row.hypothesisTranscript);
    if (reference.length) {
      edits += editDistance(reference, hypothesis);
      referenceLength += reference.length;
    } else {
      const suppliedValue = finite(row[suppliedField]);
      if (suppliedValue !== null) supplied.push(suppliedValue);
    }
  }
  if (referenceLength > 0) return edits / referenceLength;
  return average(supplied);
}

function summarizeVariant(variant, rows) {
  const slotSummary = rows.map(slotOutcome);
  const totalSlots = slotSummary.reduce((sum, item) => sum + item.total, 0);
  const preservedSlots = slotSummary.reduce((sum, item) => sum + item.preserved, 0);
  const slotSources = [...new Set(slotSummary.map((item) => item.source).filter(Boolean))];
  const latencies = rows.map((row) => finite(row.latencyMs)).filter((value) => value !== null);
  const retryRows = rows.filter((row) => nonNegative(row.retryCount) > 0);
  const dropoutRows = rows.filter(droppedAtVoiceStep);
  const preprocessingVersions = [
    ...new Set(rows.map((row) => String(row.preprocessingVersion ?? "").trim()).filter(Boolean)),
  ];

  return {
    variant,
    variantKind: variantKind(variant),
    attemptCount: rows.length,
    usableTranscriptCount: rows.filter(usableTranscript).length,
    usableTranscriptRate: ratio(rows.filter(usableTranscript).length, rows.length),
    characterErrorRate: aggregateEditMetric(rows, characterUnits, "characterErrorRate"),
    wordErrorRate: aggregateEditMetric(rows, wordUnits, "wordErrorRate"),
    semanticSlotCount: totalSlots,
    preservedSlotCount: preservedSlots,
    semanticSlotPreservationRate: ratio(preservedSlots, totalSlots),
    semanticSlotSources: slotSources,
    noSpeechCount: rows.filter(isNoSpeech).length,
    noSpeechRate: ratio(rows.filter(isNoSpeech).length, rows.length),
    retryCount: retryRows.length,
    retryRate: ratio(retryRows.length, rows.length),
    dropoutCount: dropoutRows.length,
    dropoutRate: ratio(dropoutRows.length, rows.length),
    latencyP50Ms: quantile(latencies, 0.5),
    latencyP90Ms: quantile(latencies, 0.9),
    preprocessingVersions,
  };
}

function pairRows(rows) {
  const pairs = new Map();
  for (const row of rows) {
    const basePairId = String(row.pairId ?? "").trim();
    if (!basePairId) continue;
    const day = row.day ?? row.dayIndex;
    const questionId = row.questionId ?? row.question_id;
    const pairId = [basePairId, day, questionId]
      .filter((value) => value !== undefined && value !== null && String(value).trim())
      .join("|");
    const current = pairs.get(pairId) ?? {};
    const kind = variantKind(row.variant ?? row.voiceExperienceVariant);
    if (kind === "assist" || kind === "baseline") current[kind] = row;
    pairs.set(pairId, current);
  }
  return [...pairs.values()].filter((pair) => pair.assist && pair.baseline);
}

function pairedSummary(rows) {
  const pairs = pairRows(rows);
  const usableDeltas = pairs.map(
    (pair) => Number(usableTranscript(pair.assist)) - Number(usableTranscript(pair.baseline)),
  );
  const noSpeechDeltas = pairs.map(
    (pair) => Number(isNoSpeech(pair.assist)) - Number(isNoSpeech(pair.baseline)),
  );
  const retryDeltas = pairs.map(
    (pair) => nonNegative(pair.assist.retryCount) - nonNegative(pair.baseline.retryCount),
  );
  const latencyDeltas = pairs
    .map((pair) => {
      const assist = finite(pair.assist.latencyMs);
      const baseline = finite(pair.baseline.latencyMs);
      return assist === null || baseline === null ? null : assist - baseline;
    })
    .filter((value) => value !== null);
  const cerDeltas = pairs
    .map((pair) => {
      const assist = characterErrorRate(pair.assist.referenceTranscript, pair.assist.hypothesisTranscript);
      const baseline = characterErrorRate(
        pair.baseline.referenceTranscript,
        pair.baseline.hypothesisTranscript,
      );
      return assist === null || baseline === null ? null : assist - baseline;
    })
    .filter((value) => value !== null);

  return {
    pairCount: pairs.length,
    usableTranscriptRateDelta: average(usableDeltas),
    noSpeechRateDelta: average(noSpeechDeltas),
    retryCountDelta: average(retryDeltas),
    latencyMedianDeltaMs: quantile(latencyDeltas, 0.5),
    characterErrorRateDelta: average(cerDeltas),
  };
}

function normalizeSessionDay(session) {
  const day = finite(session.day ?? session.dayIndex);
  return day === null ? null : Math.trunc(day);
}

function sessionStatus(session) {
  return String(session.status ?? session.state ?? session.completionStatus ?? "unknown")
    .toLocaleLowerCase("en-US")
    .replaceAll("-", "_");
}

function participantId(record) {
  return String(record.participantId ?? record.userId ?? record.user_id ?? "").trim();
}

function completedSession(session) {
  return sessionStatus(session) === "completed";
}

function questionType(attempt) {
  return String(attempt.questionType ?? attempt.responseType ?? attempt.type ?? "unknown");
}

function questionCompleted(attempt) {
  if (attempt.completedAt || attempt.completed_at) return true;
  return attempt.state === "completed" || attempt.status === "completed";
}

function responseFor(attempt) {
  return isRecord(attempt.response) ? attempt.response : {};
}

function questionDropout(attempt) {
  const response = responseFor(attempt);
  return (
    !questionCompleted(attempt) ||
    response.isValid === false ||
    Boolean(response.skipReason ?? attempt.skipReason)
  );
}

function buildDailyFunnel(participants, sessions) {
  const participantIds = new Set(participants.map(participantId).filter(Boolean));
  for (const session of sessions) {
    const id = participantId(session);
    if (id) participantIds.add(id);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const day = index + 1;
    const rows = sessions.filter((session) => normalizeSessionDay(session) === day);
    const startedIds = new Set(rows.map(participantId).filter(Boolean));
    const completedIds = new Set(rows.filter(completedSession).map(participantId).filter(Boolean));
    const dropoffIds = new Set(
      rows
        .filter((session) => ["exit_observed", "abandoned"].includes(sessionStatus(session)))
        .map(participantId)
        .filter(Boolean),
    );
    const previousStartedIds =
      day === 1
        ? new Set()
        : new Set(
            sessions
              .filter((session) => normalizeSessionDay(session) === day - 1)
              .map(participantId)
              .filter(Boolean),
          );
    const returnedIds = new Set([...startedIds].filter((id) => previousStartedIds.has(id)));

    return {
      day,
      eligible: participantIds.size,
      started: startedIds.size,
      completed: completedIds.size,
      partialOrExited: Math.max(0, startedIds.size - completedIds.size),
      observedDropoff: dropoffIds.size,
      absent: Math.max(0, participantIds.size - startedIds.size),
      startRate: ratio(startedIds.size, participantIds.size),
      completionRateAmongStarted: ratio(completedIds.size, startedIds.size),
      returnFromPreviousDayRate:
        day === 1 ? null : ratio(returnedIds.size, previousStartedIds.size),
    };
  });
}

function questionMetrics(attempts) {
  const groups = new Map();
  for (const attempt of attempts) {
    const questionId = String(attempt.questionId ?? attempt.question_id ?? "unknown");
    const current = groups.get(questionId) ?? [];
    current.push(attempt);
    groups.set(questionId, current);
  }

  return [...groups.entries()]
    .map(([questionId, rows]) => {
      const first = rows[0] ?? {};
      const completed = rows.filter(questionCompleted).length;
      const dropouts = rows.filter(questionDropout).length;
      const retries = rows.filter((row) => nonNegative(responseFor(row).retryCount) > 0).length;
      const invalid = rows.filter((row) => responseFor(row).isValid === false).length;
      const activeDurations = rows
        .map((row) => finite(row.activeDurationMs ?? row.active_duration_ms))
        .filter((value) => value !== null);
      const wallDurations = rows
        .map((row) => finite(row.wallDurationMs ?? row.wall_duration_ms))
        .filter((value) => value !== null);
      return {
        questionId,
        questionType: questionType(first),
        domain: first.domain ?? null,
        day: finite(first.day ?? first.dayIndex),
        ordinal: finite(first.ordinal ?? first.order),
        presented: rows.length,
        completed,
        completionRate: ratio(completed, rows.length),
        dropouts,
        dropoutRate: ratio(dropouts, rows.length),
        retryRate: ratio(retries, rows.length),
        invalidRate: ratio(invalid, rows.length),
        activeDurationP50Ms: quantile(activeDurations, 0.5),
        activeDurationP90Ms: quantile(activeDurations, 0.9),
        wallMinusActiveP50Ms: quantile(
          rows
            .map((row) => {
              const active = finite(row.activeDurationMs ?? row.active_duration_ms);
              const wall = finite(row.wallDurationMs ?? row.wall_duration_ms);
              return active === null || wall === null ? null : Math.max(0, wall - active);
            })
            .filter((value) => value !== null),
          0.5,
        ),
      };
    })
    .sort((left, right) => {
      const leftDay = left.day ?? 99;
      const rightDay = right.day ?? 99;
      return leftDay - rightDay || (left.ordinal ?? 99) - (right.ordinal ?? 99) || left.questionId.localeCompare(right.questionId);
    });
}

function voiceDropoutParticipantDays(attempts) {
  const keys = new Set();
  for (const attempt of attempts) {
    const day = finite(attempt.day ?? attempt.dayIndex);
    const id = participantId(attempt);
    if (
      id &&
      day !== null &&
      day >= 1 &&
      day < 7 &&
      questionType(attempt).includes("voice") &&
      questionDropout(attempt)
    ) {
      keys.add(`${id}|${Math.trunc(day)}`);
    }
  }
  return keys;
}

function nextDayReturnAfterVoiceDropout(sessions, dropoutKeys) {
  let returned = 0;
  for (const key of dropoutKeys) {
    const separator = key.lastIndexOf("|");
    const id = key.slice(0, separator);
    const day = Number(key.slice(separator + 1));
    if (
      sessions.some(
        (session) => participantId(session) === id && normalizeSessionDay(session) === day + 1,
      )
    ) {
      returned += 1;
    }
  }
  return {
    eligibleCount: dropoutKeys.size,
    returnedCount: returned,
    rate: ratio(returned, dropoutKeys.size),
  };
}

function participantMatrix(participants, sessions, dropoutKeys = new Set()) {
  const ids = new Set(participants.map(participantId).filter(Boolean));
  for (const session of sessions) {
    const id = participantId(session);
    if (id) ids.add(id);
  }
  return [...ids].sort().map((id) => ({
    participantId: id,
    days: Array.from({ length: 7 }, (_, index) => {
      const day = index + 1;
      const rows = sessions.filter(
        (session) => participantId(session) === id && normalizeSessionDay(session) === day,
      );
      if (!rows.length) return "absent";
      if (day > 1 && dropoutKeys.has(`${id}|${day - 1}`)) {
        return "returned_after_voice_dropoff";
      }
      if (rows.some(completedSession)) return "completed";
      if (rows.some((session) => sessionStatus(session) === "resumed")) return "resumed";
      if (rows.some((session) => ["exit_observed", "abandoned"].includes(sessionStatus(session)))) {
        return "dropoff";
      }
      return "partial";
    }),
  }));
}

function cohortValue(participant, dimension) {
  if (participant[dimension] !== undefined && participant[dimension] !== null) {
    return String(participant[dimension]);
  }
  if (dimension === "ageBand") {
    const age = finite(participant.ageAtStart ?? participant.age);
    if (age !== null) {
      const lower = Math.floor(age / 10) * 10;
      return `${lower}-${lower + 9}`;
    }
  }
  if (dimension === "voiceChallengeBand" && participant.matchedProfile?.voiceChallengeBand) {
    return String(participant.matchedProfile.voiceChallengeBand);
  }
  if (dimension === "preferredInputMode" && participant.matchedProfile?.preferredInputMode) {
    return String(participant.matchedProfile.preferredInputMode);
  }
  return "unknown";
}

function cohorts(participants, sessions, dimension) {
  const groups = new Map();
  for (const participant of participants) {
    const value = cohortValue(participant, dimension);
    const current = groups.get(value) ?? [];
    current.push(participantId(participant));
    groups.set(value, current);
  }
  return [...groups.entries()]
    .map(([value, ids]) => {
      const validIds = ids.filter(Boolean);
      const idSet = new Set(validIds);
      const groupSessions = sessions.filter((session) => idSet.has(participantId(session)));
      const completed = groupSessions.filter(completedSession).length;
      return {
        dimension,
        value,
        participantCount: validIds.length,
        startedSessionCount: groupSessions.length,
        completedSessionCount: completed,
        sessionCompletionRate: ratio(completed, groupSessions.length),
        suppressed: validIds.length < 3,
      };
    })
    .sort((left, right) => right.participantCount - left.participantCount || left.value.localeCompare(right.value));
}

function preprocessingMap(variants) {
  const map = {
    baseline: BASELINE_PREPROCESSING_FALLBACK,
    assist: ASSIST_PREPROCESSING_VERSION,
  };
  for (const variant of variants) {
    const first = variant.preprocessingVersions[0];
    if (first && (variant.variantKind === "assist" || variant.variantKind === "baseline")) {
      map[variant.variantKind] = first;
    }
  }
  return map;
}

export function analyzeSttReviewRows(reviewRowsInput, options = {}) {
  const reviewRows = array(reviewRowsInput).filter(isRecord);
  const sampleLabels = options.labelProvenance === "sample_label";
  const rowsByVariant = new Map();
  for (const row of reviewRows) {
    const variant = String(row.variant ?? row.voiceExperienceVariant ?? "unknown");
    const current = rowsByVariant.get(variant) ?? [];
    current.push(row);
    rowsByVariant.set(variant, current);
  }
  const variants = [...rowsByVariant.entries()]
    .map(([variant, rows]) => summarizeVariant(variant, rows))
    .sort((left, right) => left.variant.localeCompare(right.variant));
  return {
    primaryMetric: sampleLabels
      ? "sample_usable_transcript_rate"
      : "human_usable_transcript_rate",
    variants,
    paired: pairedSummary(reviewRows),
    preprocessing: preprocessingMap(variants),
    metricNotes: {
      humanUsableTranscriptRate:
        sampleLabels
          ? "후속 기억 단서 작성에 활용 가능한 전사 비율. no-speech와 실패도 분모에 포함."
          : "사람 검토에서 후속 기억 단서 작성에 사용할 수 있다고 표시된 전사 비율. no-speech와 실패도 분모에 포함.",
      characterErrorRate: "NFKC 정규화 후 공백·문장부호를 제외한 micro CER.",
      wordErrorRate:
        "공백 토큰 기준 micro WER. 일본어처럼 공백 없는 언어에서는 참고용이며 형태소 WER이 아님.",
      semanticSlotPreservationRate:
        "restricted review의 명시적 semanticSlots 우선. 없으면 lexical token proxy로 표시.",
    },
  };
}

export function analyzeSyntheticPilot(operationalInput, restrictedReviewInput) {
  if (!isRecord(operationalInput) || operationalInput.dataKind !== "sample") {
    throw new Error('Voice pilot analysis accepts dataKind="sample" operational data only.');
  }
  const attempts = array(
    operationalInput.questionAttempts ?? operationalInput.attempts ?? operationalInput.question_attempts,
  );
  const hasVoiceAttempts = attempts.some((attempt) => questionType(attempt).includes("voice"));
  if (
    restrictedReviewInput !== undefined &&
    (!isRecord(restrictedReviewInput) || restrictedReviewInput.dataKind !== "sample")
  ) {
    throw new Error('Separated STT review must use dataKind="sample".');
  }
  const reviewSource = isRecord(restrictedReviewInput) ? restrictedReviewInput : operationalInput;
  const reviewRows = array(reviewSource.sttReviewRows ?? reviewSource.rows);
  if (hasVoiceAttempts && reviewRows.length === 0) {
    throw new Error("Sample voice analysis requires non-empty separated STT review rows.");
  }

  const participants = array(operationalInput.participants);
  const sessions = array(
    operationalInput.routineSessions ?? operationalInput.sessions ?? operationalInput.activitySessions,
  );
  const dailyFunnel = buildDailyFunnel(participants, sessions);
  const participantCount = new Set([
    ...participants.map(participantId),
    ...sessions.map(participantId),
  ].filter(Boolean)).size;
  const day1 = dailyFunnel[0];
  const voiceAttempts = attempts.filter((attempt) => questionType(attempt).includes("voice"));
  const voiceDropouts = voiceAttempts.filter(questionDropout).length;
  const voiceDropoutDays = voiceDropoutParticipantDays(attempts);
  const voiceReturn = nextDayReturnAfterVoiceDropout(sessions, voiceDropoutDays);
  const participantWeek = participantMatrix(participants, sessions, voiceDropoutDays);

  const questions = questionMetrics(attempts);

  return {
    schemaVersion: "haru-voice-pilot-sample-analysis-v1",
    generatedAt: operationalInput.generatedAt ?? null,
    sourceSchemaVersion: operationalInput.schemaVersion ?? null,
    seed: operationalInput.seed ?? null,
    dataset: {
      dataKind: "sample",
      label: "샘플 데이터",
      containsRestrictedText: false,
      containsAudioFiles: false,
    },
    overview: {
      participantCount,
      day1Started: day1.started,
      day1Completed: day1.completed,
      day7Started: dailyFunnel[6].started,
      day7Completed: dailyFunnel[6].completed,
      fullWeekCompletedParticipantCount: participantWeek.filter((row) =>
        row.days.every((status) => status === "completed"),
      ).length,
      nextDayReturnRate: voiceReturn.rate,
      totalSessionRows: sessions.length,
      totalQuestionAttempts: attempts.length,
    },
    dailyFunnel,
    participantMatrix: participantWeek,
    questionMetrics: questions,
    dropoutHotspots: [...questions]
      .filter((question) => question.dropouts > 0)
      .sort((left, right) => right.dropouts - left.dropouts || right.dropoutRate - left.dropoutRate)
      .slice(0, 12),
    voiceOperational: {
      voiceAttemptCount: voiceAttempts.length,
      completedCount: voiceAttempts.filter(questionCompleted).length,
      dropoutCount: voiceDropouts,
      dropoutRate: ratio(voiceDropouts, voiceAttempts.length),
      nextDayReturnEligibleCount: voiceReturn.eligibleCount,
      nextDayReturnedCount: voiceReturn.returnedCount,
      nextDayReturnRate: voiceReturn.rate,
    },
    cohorts: {
      ageBand: cohorts(participants, sessions, "ageBand"),
      preferredInputMode: cohorts(participants, sessions, "preferredInputMode"),
      voiceChallengeBand: cohorts(participants, sessions, "voiceChallengeBand"),
      voiceExperienceVariant: cohorts(participants, sessions, "voiceExperienceVariant"),
    },
    stt: analyzeSttReviewRows(reviewRows, {
      labelProvenance: "sample_label",
    }),
  };
}

export const STT_ANALYSIS_CONSTANTS = Object.freeze({
  assistPreprocessingVersion: ASSIST_PREPROCESSING_VERSION,
  baselinePreprocessingFallback: BASELINE_PREPROCESSING_FALLBACK,
});
