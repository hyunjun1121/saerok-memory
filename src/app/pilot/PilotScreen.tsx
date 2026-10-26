import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button3D } from '@/components/Button3D';
import { ChoiceCard, type ChoiceCardTone } from '@/components/ChoiceCard';
import { ProgressBar } from '@/components/ProgressBar';
import { getPilotLanguage, PILOT_COPY, PILOT_QUESTIONS } from '@/features/pilot/pilotProtocol';
import { PilotVoicePart } from '@/features/pilot/ui/PilotVoicePart';
import {
  createPilotSession, deletePilotSession, isPilotParticipantNumber,
  getPilotSessionQuestions, isPilotSessionComplete, listPilotSessions, newPilotParticipantCode,
  putPilotResponse, savePilotSession, setActivePilotSession,
  type PilotPart, type PilotResponse, type PilotResponseStatus, type PilotSession, type PilotTake,
} from '@/features/pilot/pilotStorage';
import { downloadPilotExport, exportPilotSessions } from '@/features/pilot/pilotExport';
import { playPilotNarration, stopPilotNarration } from '@/features/pilot/pilotNarration';
import { usePilotButtons } from '@/features/pilot/usePilotButtons';
import { getLocalizedText } from '@/utils/localizedText';
import { flushPilotOutbox, getPilotLocalHealth } from '@/features/pilot/pilotLocalClient';
import { PilotTracker, pilotEnvironment } from '@/features/pilot/pilotTracking';

const tones: ChoiceCardTone[] = ['red', 'yellow', 'green', 'blue'];
type Stage = 'setup' | 'intro' | 'question' | 'complete';

export default function PilotScreen() {
  const [searchParams] = useSearchParams();
  const configuredLanguage = getPilotLanguage(searchParams.get('lang'));
  const [stage, setStage] = useState<Stage>('setup');
  const [participantCode, setParticipantCode] = useState(newPilotParticipantCode);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [personalizationConsent, setPersonalizationConsent] = useState(false);
  const [session, setSession] = useState<PilotSession | null>(null);
  const language = session?.language ?? configuredLanguage;
  const [storedSessions, setStoredSessions] = useState<PilotSession[]>([]);
  const [index, setIndex] = useState(0);
  const [part, setPart] = useState<PilotPart>('main');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [narrationError, setNarrationError] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [dataDirectory, setDataDirectory] = useState('');
  const tracker = useRef<PilotTracker | null>(null);
  const emitEvent = useCallback((type: string, detail?: Record<string, unknown>) => tracker.current?.emit(type, detail), []);
  const pendingSave = useRef<PilotSession | null>(null);
  const mutation = useRef(false);
  const questionStart = useRef(0);
  const previousElapsed = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const c = (key: keyof typeof PILOT_COPY) => getLocalizedText(PILOT_COPY[key], language);
  const questions = session ? getPilotSessionQuestions(session) : PILOT_QUESTIONS;
  const question = questions[index];
  const response = session?.responses.find((item) => item.questionId === question.id);
  const prompt = getLocalizedText(question.kind === 'voice' && part === 'followUp' ? question.followUp : question.prompt, language);

  useEffect(() => {
    let active = true;
    void Promise.all([listPilotSessions(), getPilotLocalHealth()]).then(([sessions, health]) => {
      if (active) { setStoredSessions(sessions); setDataDirectory(health.dataDirectory); }
    }, () => { if (active) setSaveError(true); });
    const deliveryError = () => setSaveError(true);
    const freshPage = (event: PageTransitionEvent) => { if (event.persisted) location.reload(); };
    window.addEventListener('haru:pilot-delivery-error', deliveryError);
    window.addEventListener('pageshow', freshPage);
    return () => {
      active = false;
      tracker.current?.stop('page_or_route_exit');
      stopPilotNarration();
      window.removeEventListener('haru:pilot-delivery-error', deliveryError);
      window.removeEventListener('pageshow', freshPage);
    };
  }, []);

  useEffect(() => {
    if (stage === 'question') heading.current?.focus();
  }, [stage, index, part]);

  useEffect(() => {
    tracker.current?.setView(stage, stage === 'question' ? question.id : null, stage === 'question' ? part : null);
  }, [stage, question.id, part]);

  useEffect(() => {
    if (stage !== 'setup') return;
    const select = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || target?.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (/^[1-9]$/.test(event.key)) { event.preventDefault(); setParticipantCode(event.key); }
    };
    window.addEventListener('keydown', select);
    return () => window.removeEventListener('keydown', select);
  }, [stage]);

  const persist = async (next: PilotSession): Promise<boolean> => {
    if (mutation.current) return false;
    mutation.current = true;
    setBusy(true);
    if (stage === 'question') next = { ...next, lastPoint: { questionId: question.id, part, at: new Date().toISOString(), type: 'snapshot' } };
    pendingSave.current = next;
    try {
      const written = await savePilotSession(next) ?? next;
      setSession(written);
      setStoredSessions((sessions) => [written, ...sessions.filter((item) => item.sessionId !== next.sessionId)]);
      setSaveError(false);
      pendingSave.current = null;
      setActivePilotSession(next.status === 'in_progress' ? next.sessionId : null);
      return true;
    } catch { setSaveError(true); return false; }
    finally { mutation.current = false; setBusy(false); }
  };

  const startSession = async () => {
    if (!recordingConsent || !isPilotParticipantNumber(participantCode)) return;
    const next = createPilotSession(String(Number(participantCode)), language, {
      recordingAndLocalStorage: recordingConsent, futurePersonalization: personalizationConsent,
    });
    next.environment = pilotEnvironment();
    if (await persist(next)) {
      tracker.current?.stop('new_attempt_started');
      tracker.current = new PilotTracker(next.sessionId);
      setIndex(0); setSelected(null); previousElapsed.current = 0;
      setPart('main'); setStage('intro');
    }
  };

  const commitAnswer = async (answer: PilotResponse) => {
    if (!session || busy || saveError) return;
    let next = putPilotResponse(session, answer);
    const complete = isPilotSessionComplete(next);
    if (complete) next = { ...next, status: 'completed' };
    if (!await persist(next)) return;
    tracker.current?.emit(answer.status === 'answered' ? 'answer_confirmed' : 'answer_skipped', {
      status: answer.status, optionId: answer.selectedOptionId ?? null, isCorrect: answer.isCorrect ?? null,
      responseTimeMs: answer.responseTimeMs,
      followUpStatus: answer.followUpStatus ?? null, followUpReason: answer.followUpReason ?? null,
      followUpSkipReason: answer.followUpSkipReason ?? null,
    });
    stopPilotNarration();
    setSelected(null);
    setSkipOpen(false);
    setPart('main');
    if (complete) { tracker.current?.stop('completed'); setStage('complete'); }
    else { setIndex(index + 1); previousElapsed.current = 0; questionStart.current = performance.now(); }
  };

  const confirmChoice = (optionId = selected) => {
    if (question.kind !== 'choice' || !optionId) return;
    void commitAnswer({
      questionId: question.id, status: 'answered', selectedOptionId: optionId,
      isCorrect: question.correctOptionId ? question.correctOptionId === optionId : null,
      completedAt: new Date().toISOString(), responseTimeMs: previousElapsed.current + Math.round(performance.now() - questionStart.current),
    });
  };

  const selectChoice = (id: string) => {
    if (busy || saveError) return;
    if (selected === id) confirmChoice(id);
    else {
      tracker.current?.emit('choice_selected', { optionId: id, previousOptionId: selected, changed: selected !== null });
      setSelected(id);
    }
  };

  const saveTake = async (take: PilotTake): Promise<boolean> => {
    if (!session) return false;
    return persist(putPilotResponse(session, {
      ...response,
      questionId: question.id, status: 'in_progress',
      completedAt: new Date().toISOString(), responseTimeMs: previousElapsed.current + Math.round(performance.now() - questionStart.current),
      takes: { ...response?.takes, [part]: take },
    }));
  };

  const nextVoicePart = () => {
    if (response?.takes?.main && (part === 'main' || response.takes.followUp)) {
      void commitAnswer({ ...response, status: 'answered', completedAt: new Date().toISOString(),
        followUpStatus: part === 'main' ? 'not_needed' : 'answered',
        followUpDecidedAt: response.followUpDecidedAt ?? new Date().toISOString(),
        responseTimeMs: previousElapsed.current + Math.round(performance.now() - questionStart.current) });
    }
  };

  const requestFollowUp = async () => {
    if (!session || !response?.takes?.main || part !== 'main' || busy || saveError || response.followUpStatus === 'requested') return;
    const next = putPilotResponse(session, { ...response, followUpStatus: 'requested',
      followUpReason: 'short_answer', followUpDecidedAt: new Date().toISOString() });
    if (await persist(next)) {
      tracker.current?.emit('follow_up_requested', { reason: 'short_answer', decidedBy: 'facilitator' });
      stopPilotNarration(); setPart('followUp');
    }
  };

  const skip = (status: PilotResponseStatus) => {
    if (status === 'in_progress' || status === 'answered') return;
    // Declining the optional follow-up must not erase a valid main answer.
    const skippingFollowUp = part === 'followUp' && Boolean(response?.takes?.main);
    void commitAnswer({ ...response, questionId: question.id, status: skippingFollowUp ? 'answered' : status,
      ...(skippingFollowUp ? { followUpStatus: 'skipped' as const, followUpSkipReason: status } : {}),
      completedAt: new Date().toISOString(),
      responseTimeMs: previousElapsed.current + Math.round(performance.now() - questionStart.current) });
  };

  const replay = () => {
    const narrationTracker = tracker.current;
    narrationTracker?.emit('narration_replay');
    setNarrationError(false);
    const message = stage === 'intro' ? c('intro') : `${prompt} ${question.kind === 'voice' && part === 'main' ? getLocalizedText(question.hint, language) : ''}`;
    void playPilotNarration(message, language).then((result) => {
      setNarrationError(result === 'unavailable');
      narrationTracker?.emit(result === 'unavailable' ? 'narration_error' : `narration_${result}`);
    });
  };

  const begin = () => { stopPilotNarration(); setStage('question'); questionStart.current = performance.now(); };

  const exportResponses = async (all: boolean) => {
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    try {
      tracker.current?.emit('export_requested', { all });
      const sessions = all ? await listPilotSessions() : session ? [session] : [];
      downloadPilotExport(await exportPilotSessions(sessions));
      setExportError(false);
    } catch { setExportError(true); }
    finally { mutation.current = false; setBusy(false); }
  };

  const resetParticipant = () => {
    tracker.current?.stop('participant_changed');
    tracker.current = null;
    stopPilotNarration();
    setSession(null);
    setParticipantCode(newPilotParticipantCode());
    setRecordingConsent(false);
    setPersonalizationConsent(false);
    setSelected(null);
    setIndex(0);
    previousElapsed.current = 0;
    setPart('main');
    setSaveError(false);
    setExportError(false);
    setNarrationError(false);
    pendingSave.current = null;
    setStage('setup');
  };

  const deleteRecord = async (record: PilotSession) => {
    if (mutation.current || !window.confirm(c('deleteConfirm'))) return;
    mutation.current = true;
    setBusy(true);
    try {
      await deletePilotSession(record.sessionId);
      setStoredSessions((sessions) => sessions.filter((item) => item.sessionId !== record.sessionId));
      if (session?.sessionId === record.sessionId) resetParticipant();
    } catch { setSaveError(true); }
    finally { mutation.current = false; setBusy(false); }
  };

  const skipStatuses = ['skipped', 'not_applicable', 'no_response', 'recording_failed'] as const;
  const skipLabels = ['skip', 'notApplicable', 'noResponse', 'recordingFailed'] as const;
  usePilotButtons((slot) => {
    if (skipOpen) skip(skipStatuses[slot]);
    else if (stage === 'intro') { if (slot % 2 === 0) replay(); else begin(); }
    else if (stage === 'question' && question.kind === 'choice') {
      const option = question.options[slot];
      if (option) selectChoice(option.id);
    }
  }, !busy && !saveError && (skipOpen || stage === 'intro' || (stage === 'question' && question.kind === 'choice')));

  return (
    <main lang={language} data-screen="japan-pilot" className="min-h-[100dvh] bg-background-warm px-5 py-7 text-ink">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <p className="text-lg font-extrabold text-primary-800">Haru · {c('title')}</p>
        {saveError && <div role="alert" className="rounded-2xl border-2 border-red-700 bg-red-50 p-4">
          <p>{c('storageError')}</p>
          <Button3D variant="secondary" disabled={busy} feedbackCue="none" onClick={() => {
            if (pendingSave.current) {
              const pending = pendingSave.current;
              void persist(pending).then((saved) => {
              if (saved && stage === 'setup') {
                tracker.current?.stop('new_attempt_started');
                tracker.current = new PilotTracker(pending.sessionId);
                setStage('intro');
              }
              });
            }
            else void Promise.all([flushPilotOutbox(), getPilotLocalHealth(), listPilotSessions()]).then(([, health, sessions]) => {
              setStoredSessions(sessions); setDataDirectory(health.dataDirectory); setSaveError(false);
            }, () => setSaveError(true));
          }}>{c('saveAgain')}</Button3D>
        </div>}
        {exportError && <p role="alert">{c('exportError')}</p>}
        {stage === 'setup' && <>
          <h1 className="text-3xl font-extrabold">{c('setup')}</h1>
          <p className="text-lg">{c('participantHint')}</p>
          <div className="grid grid-cols-3 gap-3" aria-label={c('participant')}>
            {[1, 2, 3, 4, 5, 6].map((number) => <Button3D key={number} variant={participantCode === String(number) ? 'primary' : 'secondary'} feedbackCue="none" pressed={participantCode === String(number)} onClick={() => setParticipantCode(String(number))}>{number}</Button3D>)}
          </div>
          <label className="flex flex-col gap-2 text-xl font-bold">{c('participant')}
            <input inputMode="numeric" className="min-h-[60px] rounded-xl border-2 border-gray-400 bg-white px-4 text-xl" value={participantCode} maxLength={5} pattern="[0-9]{1,5}" onChange={(event) => setParticipantCode(event.target.value)} />
          </label>
          <p className="text-base">{c('codeHint')}</p>
          <p className="text-lg font-bold">{c('existingAttempts')}: {storedSessions.filter((record) => record.participantCode === String(Number(participantCode))).length}</p>
          <p className="text-lg">{c('consentNote')}</p>
          <label className="flex min-h-[72px] items-start gap-4 text-xl"><input type="checkbox" className="mt-1 h-7 w-7 shrink-0" checked={recordingConsent} onChange={(event) => setRecordingConsent(event.target.checked)} />{c('recordingConsent')}</label>
          <label className="flex min-h-[72px] items-start gap-4 text-xl"><input type="checkbox" className="mt-1 h-7 w-7 shrink-0" checked={personalizationConsent} onChange={(event) => setPersonalizationConsent(event.target.checked)} />{c('personalizationConsent')}</label>
          <p className="text-lg">{c('localOnly')}</p>
          <Button3D disabled={busy || saveError || !recordingConsent || !isPilotParticipantNumber(participantCode)} feedbackCue="none" onClick={() => void startSession()}>{c('prepare')}</Button3D>
          {dataDirectory && <p className="break-all text-base">{c('dataDirectory')}: {dataDirectory}</p>}
          <p>{c('completedCount')}: {storedSessions.length}</p>
          <Button3D variant="secondary" disabled={busy || !storedSessions.length} feedbackCue="none" onClick={() => void exportResponses(true)}>{c('exportAll')}</Button3D>
          {storedSessions.length > 0 && <details className="text-base">
            <summary className="min-h-[60px] cursor-pointer">{c('completedCount')}</summary>
            {storedSessions.map((record) => <div key={record.sessionId} className="flex items-center justify-between gap-3 border-b border-gray-300 py-3">
              <span>{record.participantCode} · {c('attempt')} {record.attemptNumber ?? '—'} · {c(({ in_progress: 'collecting', completed: 'finished', stopped: 'stopped', interrupted: 'interrupted' } as const)[record.status])}</span>
              <button className="min-h-[60px] text-red-800 underline" type="button" disabled={busy} onClick={() => void deleteRecord(record)}>{c('deleteRecord')}</button>
            </div>)}
          </details>}
        </>}
        {stage === 'intro' && <>
          <h1 className="text-3xl font-extrabold">{c('title')}</h1>
          <p className="text-2xl leading-relaxed">{c('intro')}</p>
          <Button3D variant="secondary" feedbackCue="none" onClick={replay}>{c('replay')}</Button3D>
          <Button3D feedbackCue="none" onClick={begin}>{c('begin')}</Button3D>
          <p>{c('left')} · {c('right')}</p>
        </>}
        {stage === 'question' && <>
          <ProgressBar value={index + 1} max={questions.length} />
          <p className="text-base">{c('participant')} {session?.participantCode} · {c('attempt')} {session?.attemptNumber ?? '—'}</p>
          <p className="text-xl font-bold">{index + 1} / {questions.length}{question.kind === 'voice' ? ` · ${part === 'main' ? c('partMain') : c('partFollowUp')}` : ''}</p>
          <h1 ref={heading} tabIndex={-1} className="text-3xl font-extrabold leading-relaxed" data-testid="pilot-prompt">{prompt}</h1>
          {question.kind === 'voice' && part === 'main' && question.hint && <p className="text-lg leading-relaxed">{getLocalizedText(question.hint, language)}</p>}
          {question.kind === 'choice' && !skipOpen && <>
            <Button3D variant="secondary" feedbackCue="none" onClick={replay}>{c('replay')}</Button3D>
            {question.reference && <div aria-label={c('reference')} className="rounded-xl border-4 border-primary-300 py-5 text-center text-5xl font-bold">{question.reference}</div>}
            <p className="text-xl">{c('choose')}</p>
            <div className="grid grid-cols-2 gap-4" data-testid="pilot-choice-grid">
              {question.options.map((option, slot) => <ChoiceCard key={option.id} id={option.id} label={getLocalizedText(option.label, language)} layout="tile" tone={tones[slot]} state={selected === option.id ? 'selected' : busy || saveError ? 'disabled' : 'idle'} onSelect={selectChoice} keyboardShortcut={String(slot + 1)} statusLabels={{ selected: c('selected'), correct: c('thanks'), incorrect: c('retry') }} />)}
            </div>
            <Button3D disabled={!selected || busy || saveError} feedbackCue="none" onClick={() => confirmChoice()}>{c('check')}</Button3D>
            <button type="button" className="min-h-[60px] text-lg underline" disabled={busy || saveError} onClick={() => setSkipOpen(true)}>{c('skip')}</button>
          </>}
          {question.kind === 'voice' && !skipOpen && <PilotVoicePart
            key={`${session?.sessionId}:${question.id}:${part}`}
            language={language} savedTake={response?.takes?.[part]} blocked={busy || saveError}
            sessionId={session!.sessionId} questionId={question.id} part={part}
            onEvent={emitEvent}
            onFollowUp={part === 'main' ? () => void requestFollowUp() : undefined}
            onTake={saveTake} onNext={nextVoicePart} onReplay={replay} onSkip={() => setSkipOpen(true)}
          />}
          {skipOpen && <section role="group" aria-label={c('skipReason')} className="flex flex-col gap-4">
            <p>{c('skipReason')}</p>
            <div className="grid grid-cols-2 gap-4">{skipStatuses.map((status, slot) => <Button3D key={status} variant="secondary" disabled={busy || saveError} feedbackCue="none" onClick={() => skip(status)}>{c(skipLabels[slot])}</Button3D>)}</div>
            <Button3D variant="secondary" disabled={busy} feedbackCue="none" onClick={() => setSkipOpen(false)}>{c('cancel')}</Button3D>
          </section>}
          <button type="button" disabled={busy || saveError} className="min-h-[60px] text-base underline" onClick={() => {
            if (session) void persist({ ...session, status: 'stopped', updatedAt: new Date().toISOString() }).then((saved) => { if (saved) { tracker.current?.stop('operator_stop'); setStage('complete'); } });
          }}>{c('end')}</button>
        </>}
        {stage === 'complete' && <>
          <h1 className="text-3xl font-extrabold leading-relaxed">{c('complete')}</h1>
          <p className="text-2xl">{c('thanks')}</p>
          <p role="status">{c('storageReady')}</p>
          <p>{c('participant')}: {session?.participantCode} · {c('attempt')} {session?.attemptNumber ?? '—'}</p>
          <Button3D variant="secondary" disabled={busy || saveError} feedbackCue="none" onClick={() => void exportResponses(false)}>{c('exportCurrent')}</Button3D>
          <Button3D disabled={busy || saveError} feedbackCue="none" onClick={resetParticipant}>{c('nextParticipant')}</Button3D>
          {session && <button type="button" disabled={busy} className="min-h-[60px] text-lg text-red-800 underline" onClick={() => void deleteRecord(session)}>{c('deleteRecord')}</button>}
        </>}
        {narrationError && <p role="status" className="text-lg text-amber-900">{c('narrationError')}</p>}
        {busy && <p role="status">{c('saving')}</p>}
      </div>
    </main>
  );
}
