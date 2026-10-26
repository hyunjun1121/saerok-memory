import { flushPilotOutbox, pilotLocalRequest, queuePilotOperation } from '@/features/pilot/pilotLocalClient';
import type { PilotPart, PilotTake } from '@/features/pilot/pilotStorage';

export class PilotRecordingDelivery {
  readonly recordingId = crypto.randomUUID();
  private count = 0;
  private pending: Promise<void> = Promise.resolve();
  readonly sessionId: string;
  readonly questionId: string;
  readonly part: PilotPart;
  constructor(sessionId: string, questionId: string, part: PilotPart) {
    this.sessionId = sessionId; this.questionId = questionId; this.part = part;
  }

  async start(): Promise<void> {
    await flushPilotOutbox();
    await pilotLocalRequest('/recordings', 'POST', JSON.stringify({
      recordingId: this.recordingId, sessionId: this.sessionId,
      questionId: this.questionId, part: this.part, startedAt: new Date().toISOString(),
    }));
  }

  chunk(blob: Blob): void {
    if (!blob.size) return;
    const sequence = this.count++;
    this.pending = this.pending.then(() => queuePilotOperation(`/recordings/${this.recordingId}/chunks/${sequence}`, 'PUT', blob, 'application/octet-stream'));
    void this.pending.catch(() => window.dispatchEvent(new Event('haru:pilot-delivery-error')));
  }

  async finish(take: PilotTake): Promise<void> {
    // The fallback also supports browsers that only deliver a final Blob.
    if (!this.count) this.chunk(take.blob);
    await this.pending;
    await flushPilotOutbox();
    await pilotLocalRequest(`/recordings/${this.recordingId}/finish`, 'POST', JSON.stringify({
      chunkCount: this.count, mimeType: take.mimeType, durationMs: take.durationMs,
      endedAt: take.endedAt, sampleRateHz: take.sampleRateHz, channelCount: take.channelCount,
      startedAt: take.startedAt,
    }));
  }
}
