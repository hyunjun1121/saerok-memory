import { parseHaruAdminUsageRecord } from "@/features/lessons/haruAdminUsageRecordParser";
import { validateTelemetryEnvelope } from "@/features/analytics/privacy";
import {
  SYNTHETIC_VOICE_PILOT_SEED,
  generateSyntheticVoicePilot,
  serializeSyntheticVoicePilotFiles,
} from "@/features/analytics/syntheticVoicePilot";

function median(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = ordered.length / 2;
  return (ordered[middle - 1] + ordered[middle]) / 2;
}

function transcriptTokens(value: string): string[] {
  return value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function actualWordErrorRate(reference: string, hypothesis: string): number {
  const expected = transcriptTokens(reference);
  const observed = transcriptTokens(hypothesis);
  const row = Array.from({ length: observed.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= expected.length; leftIndex += 1) {
    let diagonal = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= observed.length; rightIndex += 1) {
      const above = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        diagonal + (expected[leftIndex - 1] === observed[rightIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  const distance = row[observed.length];
  return expected.length === 0
    ? Number(observed.length > 0)
    : Math.round((distance / expected.length) * 1_000) / 1_000;
}

describe("synthetic voice pilot generator", () => {
  it("builds 20 distinct Korean participants in 10 matched A/B pairs", () => {
    const bundle = generateSyntheticVoicePilot();
    const participants = bundle.operationalExport.participants;

    expect(participants).toHaveLength(20);
    expect(new Set(participants.map((participant) => participant.participantId)).size).toBe(20);
    expect(new Set(participants.map((participant) => participant.displayName)).size).toBe(20);
    expect(participants.filter((participant) => participant.voiceExperienceVariant === "baseline_v1"))
      .toHaveLength(10);
    expect(participants.filter((participant) => participant.voiceExperienceVariant === "assist_v2"))
      .toHaveLength(10);

    for (const pairId of new Set(participants.map((participant) => participant.pairId))) {
      const pair = participants.filter((participant) => participant.pairId === pairId);
      expect(pair).toHaveLength(2);
      expect(pair.map((participant) => participant.voiceExperienceVariant).sort()).toEqual([
        "assist_v2",
        "baseline_v1",
      ]);
      expect(pair[0].matchedProfile).toEqual(pair[1].matchedProfile);
    }
  });

  it("creates seven scheduled days and runtime-valid admin sessions for every participant", () => {
    const bundle = generateSyntheticVoicePilot();

    expect(bundle.adminRecords).toHaveLength(20);
    expect(bundle.operationalExport.routineSessions).toHaveLength(140);
    expect(bundle.manifest.scheduledParticipantDays).toBe(140);
    expect(bundle.manifest.dataKind).toBe("sample");
    expect(bundle.manifest.fileInventoryScope).toBe("generated_data_outputs_only");
    expect(bundle.manifest.files.some((filename) => filename.startsWith("analysis/"))).toBe(false);

    for (const record of bundle.adminRecords) {
      expect(record.dataset.is_synthetic).toBe(true);
      expect(record.dataset.market).toBe("kr");
      expect(record.dataset.ui_locale).toBe("ko-KR");
      expect(record.sessions).toHaveLength(7);
      expect(parseHaruAdminUsageRecord(record)).not.toBeNull();
      expect(record.sessions.map((session) => session.session_date)).toEqual([
        "2026-07-20",
        "2026-07-21",
        "2026-07-22",
        "2026-07-23",
        "2026-07-24",
        "2026-07-25",
        "2026-07-26",
      ]);
    }
  });

  it("is byte-deterministic for one seed and changes participant behavior for another seed", () => {
    const first = generateSyntheticVoicePilot(SYNTHETIC_VOICE_PILOT_SEED);
    const second = generateSyntheticVoicePilot(SYNTHETIC_VOICE_PILOT_SEED);
    const alternate = generateSyntheticVoicePilot("haru-voice-pilot-alternate-seed");

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(alternate.sttReviewRows).not.toEqual(first.sttReviewRows);
    expect(alternate.manifest.voiceExperienceVariants).toEqual(
      first.manifest.voiceExperienceVariants,
    );
  });

  it("keeps shareable files focused on sample data", () => {
    const files = serializeSyntheticVoicePilotFiles(generateSyntheticVoicePilot());
    const shareableText = Object.entries(files)
      .map(([filename, content]) =>
        filename.startsWith("admin_records/")
          ? content.replaceAll('"is_synthetic": true', "")
          : content,
      )
      .join("\n");

    expect(files["manifest.json"]).toContain("샘플 데이터");
    expect(shareableText).not.toMatch(
      /합성|시뮬레이션|가상|가정|synthetic|simulation|scenario/i,
    );
    expect(Object.keys(files).filter((path) => path.startsWith("admin_records/")).every(
      (path) => path === "admin_records/index.json" || /HARU-P\d{3}\.json$/.test(path),
    )).toBe(true);
  });

  it("uses unique references and chronological timestamps", () => {
    const bundle = generateSyntheticVoicePilot();
    const sessionIds = bundle.operationalExport.routineSessions.map((session) => session.sessionId);
    const attemptIds = bundle.operationalExport.questionAttempts.map(
      (attempt) => attempt.questionInstanceId,
    );
    const eventIds = bundle.operationalExport.telemetryEvents.map((event) => event.eventId);

    expect(new Set(sessionIds).size).toBe(sessionIds.length);
    expect(new Set(attemptIds).size).toBe(attemptIds.length);
    expect(new Set(eventIds).size).toBe(eventIds.length);
    expect(new Set(bundle.adminRecords.map((record) => record.device.device_id)).size).toBe(20);
    expect(
      new Set(bundle.operationalExport.telemetryEvents.map((event) => event.installationId)).size,
    ).toBe(20);
    expect(sessionIds.every((id) => /^routine_[a-f0-9]{32}$/.test(id))).toBe(true);
    expect(attemptIds.every((id) => /^question_[a-f0-9]{32}$/.test(id))).toBe(true);
    expect(eventIds.every((id) => /^evt_kr_[a-f0-9]{32}$/.test(id))).toBe(true);

    const sessionsById = new Map(
      bundle.operationalExport.routineSessions.map((session) => [session.sessionId, session]),
    );
    for (const attempt of bundle.operationalExport.questionAttempts) {
      const session = sessionsById.get(attempt.sessionId);
      expect(session?.participantId).toBe(attempt.participantId);
      expect(Number.isNaN(Date.parse(attempt.presentedAt))).toBe(false);
      if (attempt.completedAt) {
        expect(Date.parse(attempt.completedAt)).toBeGreaterThanOrEqual(Date.parse(attempt.presentedAt));
      }
    }

    for (const installationId of new Set(
      bundle.operationalExport.telemetryEvents.map((event) => event.installationId),
    )) {
      const events = bundle.operationalExport.telemetryEvents
        .filter((event) => event.installationId === installationId)
        .sort((left, right) => left.sequence - right.sequence);
      expect(events.map((event) => event.sequence)).toEqual(
        Array.from({ length: events.length }, (_, index) => index + 1),
      );
      for (let index = 1; index < events.length; index += 1) {
        expect(Date.parse(events[index].occurredAt)).toBeGreaterThanOrEqual(
          Date.parse(events[index - 1].occurredAt),
        );
      }
    }

    const sessionsByDevice = new Map<
      string,
      Array<{ startedAt: string; endedAt: string }>
    >();
    for (const record of bundle.adminRecords) {
      const intervals = sessionsByDevice.get(record.device.device_id) ?? [];
      for (const session of record.sessions) {
        expect(session.session_completed_at).toBeTruthy();
        intervals.push({
          startedAt: session.session_started_at,
          endedAt: String(session.session_completed_at),
        });
      }
      sessionsByDevice.set(record.device.device_id, intervals);
    }
    for (const intervals of sessionsByDevice.values()) {
      intervals.sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt));
      for (let index = 1; index < intervals.length; index += 1) {
        expect(Date.parse(intervals[index].startedAt)).toBeGreaterThanOrEqual(
          Date.parse(intervals[index - 1].endedAt),
        );
      }
    }
  });

  it("emits privacy-safe runtime telemetry envelopes with contract-valid voice outcomes", () => {
    const events = generateSyntheticVoicePilot().operationalExport.telemetryEvents;
    const allowedVoiceOutcomes = new Set([
      "completed",
      "no_speech",
      "permission_denied",
      "consent_required",
      "unsupported",
      "capture_failed",
      "stt_queued",
      "stt_failed",
      "cancelled",
    ]);

    expect(events.map(validateTelemetryEnvelope).filter((result) => !result.ok)).toEqual([]);
    expect(events.every((event) => /^inst_kr_[a-f0-9]{32}$/.test(event.installationId))).toBe(
      true,
    );
    expect(events.every((event) => /^visit_[a-f0-9]{32}$/.test(event.visitId))).toBe(true);
    expect(events.every((event) => !("participantId" in event))).toBe(true);

    const voiceEvents = events.filter((event) => event.eventName === "voice_capture_status");
    for (const event of voiceEvents) {
      const outcome = event.payload.outcomeReason;
      if (outcome !== undefined) expect(allowedVoiceOutcomes.has(outcome)).toBe(true);
      if (event.payload.phase === "started") expect(outcome).toBeUndefined();
    }
  });

  it("hits declared voice-pilot assumptions without changing non-voice matched-pair behavior", () => {
    const bundle = generateSyntheticVoicePilot();
    const rows = bundle.sttReviewRows;
    const expected = {
      baseline_v1: { usable: 55, noSpeech: 8, retry: 15, dropout: 10, p50: 5_500 },
      assist_v2: { usable: 64, noSpeech: 3, retry: 5, dropout: 4, p50: 3_200 },
    } as const;

    for (const variant of ["baseline_v1", "assist_v2"] as const) {
      const variantRows = rows.filter((row) => row.voiceExperienceVariant === variant);
      expect(variantRows).toHaveLength(70);
      expect(variantRows.filter((row) => row.usableTranscript)).toHaveLength(expected[variant].usable);
      expect(variantRows.filter((row) => row.noSpeech)).toHaveLength(expected[variant].noSpeech);
      expect(variantRows.filter((row) => row.retryCount > 0)).toHaveLength(expected[variant].retry);
      expect(variantRows.filter((row) => row.droppedAtVoiceStep)).toHaveLength(
        expected[variant].dropout,
      );
      expect(median(variantRows.map((row) => row.latencyMs))).toBe(expected[variant].p50);

      const dropoutRows = variantRows.filter((row) => row.droppedAtVoiceStep);
      const dropoutCounts = new Map<string, number>();
      for (const row of dropoutRows) {
        dropoutCounts.set(row.participantId, (dropoutCounts.get(row.participantId) ?? 0) + 1);
      }
      expect(Math.max(...dropoutCounts.values())).toBeLessThanOrEqual(2);
      expect(dropoutCounts.size).toBeGreaterThanOrEqual(variant === "baseline_v1" ? 8 : 4);
    }

    for (const pairId of new Set(bundle.operationalExport.participants.map((item) => item.pairId))) {
      const pair = bundle.operationalExport.participants.filter((item) => item.pairId === pairId);
      const baselineId = pair.find((item) => item.voiceExperienceVariant === "baseline_v1")
        ?.participantId;
      const assistId = pair.find((item) => item.voiceExperienceVariant === "assist_v2")
        ?.participantId;
      const project = (participantId: string | undefined) =>
        bundle.operationalExport.questionAttempts
          .filter(
            (attempt) =>
              attempt.participantId === participantId &&
              attempt.questionType !== "voice" &&
              attempt.personalizationSourceQuestionIds.length === 0,
          )
          .map((attempt) => ({
            day: attempt.day,
            questionId: attempt.questionId,
            activeDurationMs: attempt.activeDurationMs,
            response: attempt.response,
          }));
      expect(project(baselineId)).toEqual(project(assistId));
    }
  });

  it("keeps technical STT state, transcript storage, and WER internally consistent", () => {
    const bundle = generateSyntheticVoicePilot();

    for (const row of bundle.sttReviewRows) {
      expect(row.wordErrorRate).toBe(
        actualWordErrorRate(row.referenceTranscript, row.hypothesisTranscript),
      );
      if (row.droppedAtVoiceStep) expect(row.status).toBe("abandoned");
      else if (row.noSpeech) expect(row.status).toBe("no_speech");
      else expect(row.status).toBe("completed");
    }

    for (const record of bundle.adminRecords) {
      for (const session of record.sessions) {
        for (const questionRecord of session.question_records) {
          const response = questionRecord.response;
          if (!response || !("stt" in response)) continue;
          expect(response.raw_user_utterance_transcript).toBe(response.stt.transcript);
          expect(response.stt.status).toBe(response.stt.no_speech ? "failed" : "completed");
          if (response.stt.no_speech) expect(response.stt.transcript).toBeNull();
        }
      }
    }

    const usableRows = bundle.sttReviewRows.filter(
      (row) => row.usableTranscript && !row.noSpeech,
    );
    expect(usableRows.every((row) => row.hypothesisTranscript !== row.referenceTranscript)).toBe(
      true,
    );
    expect(
      new Set(
        bundle.sttReviewRows
          .filter((row) => !row.usableTranscript && !row.noSpeech)
          .map((row) => row.hypothesisTranscript),
      ).size,
    ).toBeGreaterThan(1);
  });

  it("keeps all synthetic persona prompts, source notes, and medication times coherent", () => {
    const bundle = generateSyntheticVoicePilot();
    const allAuthoredText = JSON.stringify({
      adminRecords: bundle.adminRecords,
      sttReviewRows: bundle.sttReviewRows,
    });

    expect(allAuthoredText).not.toMatch(
      /대파을|책 읽기을|오미자차을|김유준와|홍천라고|30분 30분/u,
    );

    const particleFor = (value: string, consonant: string, vowel: string) => {
      const codePoint = Array.from(value.trim()).at(-1)?.codePointAt(0) ?? 0;
      return codePoint >= 0xac00 && codePoint <= 0xd7a3 && (codePoint - 0xac00) % 28 !== 0
        ? consonant
        : vowel;
    };

    for (const record of bundle.adminRecords) {
      const participantId = record.user.user_id;
      const fields = record.user.registered_profile_fields;
      const daughter = String(fields.딸);
      const friend = String(fields.가까운친구);
      const dayOneReference = bundle.sttReviewRows.find(
        (row) => row.participantId === participantId && row.day === 1,
      )?.referenceTranscript;
      const dayTwoReference = bundle.sttReviewRows.find(
        (row) => row.participantId === participantId && row.day === 2,
      )?.referenceTranscript;

      expect(dayOneReference).toContain(
        `딸 ${daughter}${particleFor(daughter, "이", "가")}`,
      );
      expect(dayTwoReference).toContain(
        `친구 ${friend}${particleFor(friend, "을", "를")}`,
      );

      const participantText = JSON.stringify({
        record,
        reviewRows: bundle.sttReviewRows.filter(
          (row) => row.participantId === participantId,
        ),
      });
      const nameTokens = [
        String(record.user.display_name).slice(1),
        daughter,
        daughter.slice(1),
        String(fields.손자),
        String(fields.손자).slice(1),
        friend,
        friend.slice(1),
        String(fields.이웃),
        String(fields.이웃).slice(1),
      ];
      const particlePairs = [
        ["이에요", "예요"],
        ["이라고", "라고"],
        ["을", "를"],
        ["이", "가"],
        ["과", "와"],
      ] as const;
      for (const token of nameTokens) {
        for (const [consonant, vowel] of particlePairs) {
          const wrongParticle = particleFor(token, vowel, consonant);
          expect(participantText).not.toContain(`${token}${wrongParticle}`);
        }
      }
    }

    for (const record of bundle.adminRecords) {
      const medicationTime = String(record.user.registered_profile_fields.복약시간);
      const medicationQuestion = record.sessions[2].question_records.find(
        (item) => item.question.question_id === "D3_Q4",
      );
      expect(medicationQuestion?.question.prompt_text).toContain(`${medicationTime}에`);
      const expectedBreakfast = medicationQuestion?.question.choices?.find(
        (choice) => choice.button === "B",
      )?.label;
      expect(expectedBreakfast).toBeTruthy();
      expect(medicationQuestion?.system_feedback?.feedback_text).toContain(
        String(expectedBreakfast),
      );

      for (const session of record.sessions) {
        for (const questionRecord of session.question_records) {
          const note = questionRecord.question.personalization_source_note;
          if (!note) continue;
          expect(note).toMatch(
            /^(?:초기 등록 정보|[1-7]일차 (?:음성 )?응답) 기반 개인화$/u,
          );
          expect(note).not.toMatch(/유성|민지|준호|순자|보리차|단팥빵/u);
        }
      }
    }
  });

  it("models abandonment only at voice steps and returns participants the next day", () => {
    const bundle = generateSyntheticVoicePilot();
    const sessions = bundle.operationalExport.routineSessions;
    const abandoned = sessions.filter((session) => session.state === "abandoned");

    expect(abandoned).toHaveLength(14);
    expect(abandoned.every((session) => session.dropoutCause === "voice_step")).toBe(true);
    for (const session of abandoned) {
      const attempts = bundle.operationalExport.questionAttempts.filter(
        (attempt) => attempt.sessionId === session.sessionId,
      );
      expect(attempts.at(-1)?.questionType).toBe("voice");
      expect(attempts.at(-1)?.status).toBe("abandoned");

      if (session.day < 7) {
        expect(
          sessions.some(
            (candidate) =>
              candidate.participantId === session.participantId && candidate.day === session.day + 1,
          ),
        ).toBe(true);
      }
    }
  });

  it("keeps personalization provenance consistent and falls back after missing source responses", () => {
    const bundle = generateSyntheticVoicePilot();
    const attempts = bundle.operationalExport.questionAttempts;

    expect(attempts.some((attempt) => attempt.personalizationKind === "prior_response")).toBe(true);
    expect(attempts.some((attempt) => attempt.personalizationKind === "fallback")).toBe(true);

    for (const attempt of attempts) {
      for (const sourceQuestionId of attempt.personalizationSourceQuestionIds) {
        const source = attempts.find(
          (candidate) =>
            candidate.participantId === attempt.participantId &&
            candidate.questionId === sourceQuestionId &&
            candidate.day < attempt.day,
        );
        if (attempt.personalizationKind === "prior_response") {
          expect(source?.status).toBe("completed");
          expect(source?.response?.isValid).toBe(true);
        }
      }
    }
  });

  it("stores no audio and keeps transcript material out of normalized general CSVs", () => {
    const bundle = generateSyntheticVoicePilot();
    const files = serializeSyntheticVoicePilotFiles(bundle);

    expect(files["normalized/consent_receipts.csv"]).toContain("receipt_id,participant_id");
    expect(files["normalized/telemetry_events.csv"]).toContain("event_id,participant_id,event_name");
    expect(files["normalized/telemetry_events.csv"]).toContain("voiceExperienceVariant");
    expect(files["operational_export.json"]).not.toMatch(
      /referenceTranscript|hypothesisTranscript|raw_user_utterance_transcript/i,
    );
    expect(bundle.manifest.analysisArtifactIndex).toBe("analysis/artifact-index.json");

    for (const record of bundle.adminRecords) {
      for (const session of record.sessions) {
        for (const questionRecord of session.question_records) {
          const response = questionRecord.response;
          if (response && "audio_storage" in response) {
            expect(response.audio_storage.object_key).toBe("");
            expect(response.audio_storage.retention_status).toBe("not_stored");
          }
        }
      }
    }

    for (const [path, contents] of Object.entries(files)) {
      if (!path.startsWith("normalized/")) continue;
      expect(contents).not.toMatch(/referenceTranscript|hypothesisTranscript|raw_user|object_key/i);
      expect(contents).not.toContain("오늘 오전에");
    }
  });
});
