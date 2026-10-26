import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PilotScreen from '@/app/pilot/PilotScreen';
import type { PilotSession } from '@/features/pilot/pilotStorage';
import '@/i18n';

const mocks = vi.hoisted(() => ({ sessions: [] as PilotSession[], save: vi.fn(), stop: vi.fn(), events: vi.fn(), narration: vi.fn(), recorderError: null as string | null }));
vi.mock('@/features/pilot/pilotStorage', async (original) => ({
  ...await original<typeof import('@/features/pilot/pilotStorage')>(),
  listPilotSessions: async () => mocks.sessions,
  savePilotSession: async (session: PilotSession) => {
    await mocks.save(session);
    const existing = mocks.sessions.find((item) => item.sessionId === session.sessionId);
    const saved = { ...session, attemptNumber: existing?.attemptNumber ?? mocks.sessions.filter((item) => item.participantCode === session.participantCode).length + 1 };
    mocks.sessions = [saved, ...mocks.sessions.filter((item) => item.sessionId !== session.sessionId)];
    return saved;
  },
}));
vi.mock('@/features/pilot/pilotLocalClient', () => ({ getPilotLocalHealth: async () => ({ ready: true, dataDirectory: 'C:/pilot-data' }), flushPilotOutbox: async () => {}, queuePilotOperation: async () => {}, pilotLocalRequest: vi.fn() }));
vi.mock('@/features/pilot/pilotTracking', () => ({ pilotEnvironment: () => ({}), PilotTracker: class {
  emit = mocks.events;
  setView = vi.fn();
  stop = vi.fn();
} }));
vi.mock('@/features/pilot/pilotRecording', () => ({ PilotRecordingDelivery: class {
  recordingId = 'test-recording';
  start = async () => {};
  chunk = vi.fn();
  finish = async () => {};
} }));
vi.mock('@/features/speech/useVoiceRecorder', () => ({ useVoiceRecorder: () => ({
  isSupported: true, isRecording: false, isFinalizing: false, levels: [], error: mocks.recorderError,
  start: vi.fn(), stopAndFinalize: mocks.stop,
}) }));
vi.mock('@/features/pilot/pilotNarration', () => ({ playPilotNarration: mocks.narration, stopPilotNarration: vi.fn() }));

function open() { return render(<MemoryRouter initialEntries={['/pilot']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><PilotScreen /></MemoryRouter>); }
async function begin() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'お話を始める' })).toBeDisabled());
  fireEvent.click(screen.getAllByRole('checkbox')[0]);
  fireEvent.click(screen.getByRole('button', { name: 'お話を始める' }));
  fireEvent.click(await screen.findByRole('button', { name: '始めましょう' }));
}

describe('fixed Japanese pilot flow', () => {
  beforeEach(() => {
    mocks.sessions = [];
    mocks.save.mockReset().mockResolvedValue(undefined);
    mocks.narration.mockReset().mockResolvedValue('finished');
    mocks.events.mockReset();
    mocks.recorderError = null;
    mocks.stop.mockReset().mockResolvedValue({ blob: new Blob(['recorded-audio'], { type: 'audio/webm' }), mimeType: 'audio/webm', durationMs: 1000, startedAt: new Date().toISOString(), endedAt: new Date().toISOString() });
    URL.createObjectURL = vi.fn(() => 'blob:pilot-test');
    URL.revokeObjectURL = vi.fn();
    localStorage.clear();
  });

  it('persists both fixed voice phases separately before advancing', async () => {
    open();
    await begin();
    fireEvent.click(screen.getByRole('button', { name: 'とても良い' }));
    expect(screen.getByTestId('pilot-prompt')).toHaveTextContent('今日の気分');
    fireEvent.click(screen.getByRole('button', { name: 'これにする' }));
    expect(await screen.findByText('子どものころは、どのあたりで暮らしていましたか。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '話し始める' }));
    fireEvent.click(await screen.findByRole('button', { name: '話し終わった' }));
    await waitFor(() => expect(mocks.sessions[0].responses.at(-1)?.takes?.main?.blob.size).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));
    expect(screen.getByTestId('pilot-prompt')).toHaveTextContent('そのころ、よくしていた遊び');
    fireEvent.click(screen.getByRole('button', { name: '話し始める' }));
    fireEvent.click(await screen.findByRole('button', { name: '話し終わった' }));
    await waitFor(() => expect(mocks.sessions[0].responses.at(-1)?.takes?.followUp?.blob.size).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));
    expect(await screen.findByText('これまで、長く続けてきた仕事や役割を一つ教えてください。')).toBeInTheDocument();
    expect(mocks.sessions[0].responses[1].status).toBe('answered');
  });

  it('keeps the question in place on failed storage and enables retry', async () => {
    open();
    await begin();
    mocks.save.mockRejectedValueOnce(new Error('quota exceeded'));
    fireEvent.click(screen.getByRole('button', { name: '良い' }));
    fireEvent.click(screen.getByRole('button', { name: 'これにする' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('保存できません');
    expect(screen.getByTestId('pilot-prompt')).toHaveTextContent('今日の気分');
    expect(screen.getByRole('button', { name: 'これにする' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'もう一度保存する' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('records skip reasons and always starts a new attempt for the same numbered participant', async () => {
    open();
    await begin();
    for (let index = 0; index < 12; index++) {
      fireEvent.click(screen.getByRole('button', { name: 'このお話を飛ばす' }));
      const reason = index === 0 ? '当てはまらない' : '答えが出てこない';
      fireEvent.click(screen.getByRole('button', { name: reason }));
      await waitFor(() => expect(mocks.sessions[0].responses).toHaveLength(index + 1));
    }
    expect(await screen.findByText('今日のお話は ここまでです')).toBeInTheDocument();
    const original = mocks.sessions[0];
    expect(original.status).toBe('completed');
    expect(original.responses[0].status).toBe('not_applicable');
    fireEvent.click(screen.getByRole('button', { name: '次の参加者を準備する' }));
    expect(screen.getAllByRole('checkbox')[0]).not.toBeChecked();
    expect(screen.getAllByRole('checkbox')[1]).not.toBeChecked();
    expect(screen.getByRole('textbox')).toHaveValue('1');
    expect(mocks.sessions[0].sessionId).toBe(original.sessionId);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'お話を始める' }));
    fireEvent.click(await screen.findByRole('button', { name: '始めましょう' }));
    expect(screen.getByTestId('pilot-prompt')).toHaveTextContent('今日の気分');
    expect(mocks.sessions).toHaveLength(2);
    expect(mocks.sessions[0].participantCode).toBe(original.participantCode);
    expect(mocks.sessions[0].sessionId).not.toBe(original.sessionId);
    expect(mocks.sessions[0].attemptNumber).toBe(2);
    expect(mocks.sessions[1].responses).toHaveLength(12);
  });

  it('reopens at setup and starts from question one while retaining the old partial answer', async () => {
    const first = open();
    await begin();
    fireEvent.click(screen.getByRole('button', { name: '良い' }));
    fireEvent.click(screen.getByRole('button', { name: 'これにする' }));
    await screen.findByText('子どものころは、どのあたりで暮らしていましたか。');
    fireEvent.click(screen.getByRole('button', { name: '話し始める' }));
    fireEvent.click(await screen.findByRole('button', { name: '話し終わった' }));
    await waitFor(() => expect(mocks.sessions[0].responses.at(-1)?.takes?.main).toBeTruthy());
    first.unmount();
    mocks.recorderError = 'permission-denied';
    open();
    await begin();
    expect(screen.getByTestId('pilot-prompt')).toHaveTextContent('今日の気分');
    expect(mocks.sessions).toHaveLength(2);
    expect(mocks.sessions[0].responses).toEqual([]);
    expect(mocks.sessions[1].responses[1].takes?.main?.blob.size).toBeGreaterThan(0);
  });

  it('accepts participant number six with the keyboard before starting', async () => {
    open();
    fireEvent.keyDown(window, { key: '6', code: 'Digit6' });
    expect(screen.getByRole('textbox')).toHaveValue('6');
    await begin();
    expect(mocks.sessions[0].participantCode).toBe('6');
  });

  it('records intentional narration cancellation without showing an unavailable warning', async () => {
    open();
    await begin();
    mocks.narration.mockResolvedValueOnce('cancelled');
    fireEvent.click(screen.getByRole('button', { name: 'もう一度聞く' }));
    await waitFor(() => expect(mocks.events).toHaveBeenCalledWith('narration_cancelled'));
    expect(screen.queryByText(/音声案内が使えません/)).not.toBeInTheDocument();

    mocks.narration.mockResolvedValueOnce('unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'もう一度聞く' }));
    expect(await screen.findByText(/音声案内が使えません/)).toBeInTheDocument();
    expect(mocks.events).toHaveBeenCalledWith('narration_error');
  });
});
