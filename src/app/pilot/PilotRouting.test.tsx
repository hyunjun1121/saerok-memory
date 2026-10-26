import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import '@/i18n';

const mocks = vi.hoisted(() => ({ telemetry: vi.fn(), seed: vi.fn(), sync: vi.fn() }));
vi.mock('@/features/analytics/client', () => ({ startHaruTelemetry: mocks.telemetry, recordHaruRouteView: vi.fn() }));
vi.mock('@/features/memory/memoryCardStorage', () => ({ ensureDemoSeedCards: mocks.seed }));
vi.mock('@/features/lessons/haruBackgroundSync', () => ({ startHaruBackgroundSync: mocks.sync }));
vi.mock('@/app/pilot/PilotScreen', () => ({ default: () => <div data-testid="isolated-pilot" /> }));

describe('pilot route isolation', () => {
  beforeEach(() => { vi.clearAllMocks(); window.history.pushState({}, '', '/pilot'); });
  it('opens the pilot without routine telemetry, demo facts, or STT/RAG synchronization', async () => {
    render(<App />);
    expect(await screen.findByTestId('isolated-pilot')).toBeInTheDocument();
    expect(mocks.telemetry).not.toHaveBeenCalled();
    expect(mocks.seed).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });
});
