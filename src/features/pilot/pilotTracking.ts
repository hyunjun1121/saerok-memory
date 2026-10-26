import { queuePilotOperation } from '@/features/pilot/pilotLocalClient';
import type { PilotPart } from '@/features/pilot/pilotStorage';

export interface PilotEvent {
  eventId: string;
  sessionId: string;
  type: string;
  at: string;
  elapsedMs: number;
  questionId: string | null;
  part: PilotPart | null;
  detail: Record<string, unknown>;
  receivedAt?: string;
}

export function pilotEnvironment(): Record<string, string | number | boolean | null> {
  return {
    userAgent: navigator.userAgent, language: navigator.language,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    viewportWidth: innerWidth, viewportHeight: innerHeight,
    screenWidth: screen.width, screenHeight: screen.height, devicePixelRatio,
    maxTouchPoints: navigator.maxTouchPoints, online: navigator.onLine,
    mediaRecorderSupported: typeof MediaRecorder !== 'undefined',
    appBuild: import.meta.env.MODE,
  };
}

export class PilotTracker {
  private start = performance.now();
  private viewStart = this.start;
  private visibleStart = document.visibilityState === 'hidden' || !document.hasFocus() ? null : this.start;
  private activeMs = 0;
  private questionId: string | null = null;
  private part: PilotPart | null = null;
  private viewId = crypto.randomUUID();
  private stage = 'intro';
  private stopped = false;
  private timer: ReturnType<typeof setInterval>;

  readonly sessionId: string;
  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.emit('session_start', { environment: pilotEnvironment() });
    this.emit('view_enter', this.timing());
    this.timer = setInterval(() => { this.emit('view_checkpoint', this.timing()); }, 5000);
    document.addEventListener('visibilitychange', this.visibility);
    window.addEventListener('focus', this.focus);
    window.addEventListener('blur', this.blur);
    window.addEventListener('pagehide', this.pagehide);
    window.addEventListener('online', this.online);
    window.addEventListener('offline', this.offline);
    document.addEventListener('pointerdown', this.pointer);
    document.addEventListener('keydown', this.key);
  }

  private timing() {
    const now = performance.now();
    return { viewId: this.viewId, stage: this.stage, dwellMs: Math.round(now - this.viewStart),
      activeMs: Math.round(this.activeMs + (this.visibleStart === null ? 0 : now - this.visibleStart)),
      visible: document.visibilityState !== 'hidden', focused: document.hasFocus() };
  }

  emit(type: string, detail: Record<string, unknown> = {}): void {
    if (this.stopped) return;
    const event = this.event(type, detail);
    void queuePilotOperation('/events', 'POST', JSON.stringify(event)).catch(() => window.dispatchEvent(new Event('haru:pilot-delivery-error')));
  }

  private event(type: string, detail: Record<string, unknown>): PilotEvent {
    return { eventId: crypto.randomUUID(), sessionId: this.sessionId, type,
      at: new Date().toISOString(), elapsedMs: Math.round(performance.now() - this.start),
      questionId: this.questionId, part: this.part, detail: { ...this.timing(), ...detail } };
  }

  setView(stage: string, questionId: string | null, part: PilotPart | null): void {
    if (stage === this.stage && questionId === this.questionId && part === this.part) return;
    this.emit('view_exit', { ...this.timing(), reason: 'next_view' });
    this.stage = stage;
    this.questionId = questionId;
    this.part = part;
    this.viewId = crypto.randomUUID();
    this.viewStart = performance.now();
    this.activeMs = 0;
    this.visibleStart = document.visibilityState === 'hidden' || !document.hasFocus() ? null : this.viewStart;
    this.emit('view_enter', this.timing());
  }

  private visibility = () => {
    this.emit('view_checkpoint', this.timing());
    const now = performance.now();
    if (document.visibilityState === 'hidden') {
      if (this.visibleStart !== null) this.activeMs += now - this.visibleStart;
      this.visibleStart = null;
    } else if (document.hasFocus()) this.visibleStart ??= now;
    this.emit(document.visibilityState === 'hidden' ? 'page_hidden' : 'page_visible', this.timing());
  };
  private focus = () => {
    if (document.visibilityState !== 'hidden') this.visibleStart ??= performance.now();
    this.emit('window_focus', this.timing());
  };
  private blur = () => {
    this.emit('window_blur', this.timing());
    if (this.visibleStart !== null) this.activeMs += performance.now() - this.visibleStart;
    this.visibleStart = null;
  };
  private online = () => this.emit('network_online');
  private offline = () => this.emit('network_offline');
  private pointer = (event: PointerEvent) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (button) this.emit('button_press', { mode: event.pointerType || 'pointer', choiceId: button.getAttribute('data-choice-id'), action: button.getAttribute('data-pilot-action') });
  };
  private key = (event: KeyboardEvent) => {
    if (!event.repeat && /^[1-4]$/.test(event.key)) this.emit('button_press', { mode: 'keyboard_or_physical', key: event.key });
  };
  private pagehide = (event: PageTransitionEvent) => {
    const payload = this.event('page_exit', { ...this.timing(), reason: event.persisted ? 'page_cached' : 'page_closed_or_navigated' });
    const body = JSON.stringify(payload);
    // Beacon is a best-effort final checkpoint. The regular outbox provides an
    // idempotent retry if the browser gets enough time to commit it locally.
    if (typeof navigator.sendBeacon === 'function') navigator.sendBeacon('/api/pilot-local/events', new Blob([body], { type: 'application/json' }));
    void queuePilotOperation('/events', 'POST', body).catch(() => undefined);
  };

  stop(reason: string): void {
    if (this.stopped) return;
    this.emit('view_exit', { ...this.timing(), reason });
    this.emit('session_end', { reason });
    this.stopped = true;
    clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.visibility);
    window.removeEventListener('focus', this.focus);
    window.removeEventListener('blur', this.blur);
    window.removeEventListener('pagehide', this.pagehide);
    window.removeEventListener('online', this.online);
    window.removeEventListener('offline', this.offline);
    document.removeEventListener('pointerdown', this.pointer);
    document.removeEventListener('keydown', this.key);
  }
}
