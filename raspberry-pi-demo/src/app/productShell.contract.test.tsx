import { act, fireEvent, render, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { loadRuntimeInputConfig } from "@/config/runtimeConfig";
import { audioManager } from "@/features/audio";

vi.mock("@/config/runtimeConfig", () => ({
  loadRuntimeInputConfig: vi.fn(),
}));

vi.mock("@/features/audio", () => ({
  audioManager: {
    load: vi.fn().mockResolvedValue(true),
    playNarration: vi.fn().mockResolvedValue({ status: "played" }),
    playUi: vi.fn().mockResolvedValue({ status: "played" }),
    stopNarration: vi.fn(),
  },
}));

const NEW_MASCOT_PATH = "/assets/haru/mascot_turtle.jpg";
const NEW_HARU_LOGO_PATH = "/assets/haru/haru_logo_color.png";
const SUPPORT_CODE_PATTERN = /^\d{4}-\d{4}$/;
const SUPPORT_CONNECTION_LABEL = /^(보호자\/상담사 연결|ご家族・支援者との連携)$/;
const CAREGIVER_CONNECTION_LABEL = /^(보호자 연결|ご家族と連携)$/;
const COUNSELOR_CONNECTION_LABEL = /^(상담사 연결|支援者と連携)$/;

const runtimeConfig = {
  version: 1,
  debounceMs: 200,
  bindings: {
    topLeft: { key: "1", code: "Digit1" },
    topRight: { key: "2", code: "Digit2" },
    bottomLeft: { key: "3", code: "Digit3" },
    bottomRight: { key: "4", code: "Digit4" },
  },
} as const;

function renderAt(hashRoute: string) {
  window.location.hash = hashRoute;
  return render(<App />);
}

async function findElement(selector: string): Promise<HTMLElement> {
  await waitFor(() => {
    expect(document.querySelector<HTMLElement>(selector)).not.toBeNull();
  });
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing test element: ${selector}`);
  return element;
}

function pressPhysicalKey(code: "Digit1" | "Digit2" | "Digit3" | "Digit4" | "Digit5") {
  const key = code.at(-1) ?? "";
  fireEvent.keyDown(window, { code, key });
  fireEvent.keyUp(window, { code, key });
}

function settlePhysicalInput() {
  return new Promise((resolve) => setTimeout(resolve, 210));
}

describe("offline product-shell contract", () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = "";
    vi.clearAllMocks();
    vi.mocked(loadRuntimeInputConfig).mockResolvedValue({
      status: "ready",
      config: runtimeConfig,
    });
  });

  it("uses the new Haru logo in the AppFrame top-left header", async () => {
    renderAt("#/lesson?day=1&restart=1");

    const logo = await findElement(".screen-header__logo");
    expect(logo).toHaveAttribute("src", NEW_HARU_LOGO_PATH);
  });

  it("waits for the NFC card key before showing the lesson start screen", async () => {
    renderAt("#/lesson?day=1&restart=1");

    const login = await findElement('[data-screen="nfc-login"]');
    expect(login).toHaveAttribute("data-auth-method", "nfc-keyboard-5");
    expect(login).toHaveTextContent("카드를 대주세요");
    await act(async () => pressPhysicalKey("Digit1"));
    expect(document.querySelector('[data-screen="nfc-login"]')).toBeInTheDocument();

    await act(async () => pressPhysicalKey("Digit5"));
    expect(await findElement('[data-screen="lesson-start"]')).toBeInTheDocument();
    expect(document.querySelector('[data-screen="nfc-login"]')).toBeNull();
    expect(vi.mocked(audioManager.playNarration)).toHaveBeenCalledWith("login.nfc.waiting", "ko");
  });

  it("replays the NFC waiting instruction for every physical button", async () => {
    renderAt("#/lesson?day=1&restart=1");
    await findElement('[data-screen="nfc-login"]');
    await waitFor(() => {
      expect(vi.mocked(audioManager.playNarration)).toHaveBeenCalledWith("login.nfc.waiting", "ko");
    });
    vi.mocked(audioManager.playNarration).mockClear();

    for (const code of ["Digit1", "Digit2", "Digit3", "Digit4"] as const) {
      await act(async () => pressPhysicalKey(code));
      await waitFor(() => {
        expect(vi.mocked(audioManager.playNarration)).toHaveBeenCalledTimes(1);
      });
      expect(vi.mocked(audioManager.playNarration)).toHaveBeenLastCalledWith(
        "login.nfc.waiting",
        "ko",
      );
      vi.mocked(audioManager.playNarration).mockClear();
      await settlePhysicalInput();
      expect(document.querySelector('[data-screen="nfc-login"]')).toBeInTheDocument();
    }
  });

  it.each([
    ["result", "#/result?day=1", '[data-screen="result"] .hero-card__mascot'],
    ["legacy garden route", "#/garden", ".info-card__image"],
    ["settings", "#/settings", ".info-card__image"],
    ["onboarding", "#/onboarding", ".info-card__image"],
  ])("uses the new mascot on the %s screen", async (_name, route, selector) => {
    renderAt(route);

    const mascot = await findElement(selector);
    expect(mascot).toHaveAttribute("src", NEW_MASCOT_PATH);
  });

  it("uses the new mascot on the lesson start screen after NFC login", async () => {
    renderAt("#/lesson?day=1&restart=1");
    await findElement('[data-screen="nfc-login"]');
    await act(async () => pressPhysicalKey("Digit5"));
    const mascot = await findElement('[data-screen="lesson-start"] .hero-card__mascot');
    expect(mascot).toHaveAttribute("src", NEW_MASCOT_PATH);
  });

  it("replaces the kiosk garden tile with the supporter connection tile", async () => {
    renderAt("#/kiosk");

    const kiosk = await findElement('[data-screen="kiosk-menu"]');
    const supporterTile = kiosk.querySelector<HTMLElement>('[data-path="/connect"]');
    expect(supporterTile).not.toBeNull();
    expect(supporterTile).toHaveTextContent(SUPPORT_CONNECTION_LABEL);
    expect(kiosk.querySelector('[data-path="/garden"]')).toBeNull();
  });

  it("renders separate caregiver and counselor reveal actions on the supporter screen", async () => {
    renderAt("#/connect");

    const supporter = await findElement('[data-screen="support-connection"]');
    expect(within(supporter).getByText(SUPPORT_CONNECTION_LABEL)).toBeInTheDocument();
    expect(within(supporter).getByRole("button", { name: CAREGIVER_CONNECTION_LABEL })).toHaveAttribute(
      "data-support-action",
      "caregiver",
    );
    expect(within(supporter).getByRole("button", { name: COUNSELOR_CONNECTION_LABEL })).toHaveAttribute(
      "data-support-action",
      "counselor",
    );
    expect(supporter.querySelector('[data-support-code="caregiver"]')).toBeNull();
    expect(supporter.querySelector('[data-support-code="counselor"]')).toBeNull();
  });

  it("maps right-column B to caregiver and D to counselor while reserving A and C for back", async () => {
    renderAt("#/connect");
    const supporter = await findElement('[data-screen="support-connection"]');

    await act(async () => pressPhysicalKey("Digit2"));
    expect(supporter.querySelector('[data-support-code="caregiver"]')).toBeNull();
    expect(within(supporter).getByRole("button", { name: CAREGIVER_CONNECTION_LABEL })).toHaveClass(
      "is-selected",
    );

    await settlePhysicalInput();
    await act(async () => pressPhysicalKey("Digit2"));
    const caregiverCode = await findElement('[data-support-code="caregiver"]');
    expect(caregiverCode).toHaveTextContent(SUPPORT_CODE_PATTERN);
    expect(supporter.querySelector('[data-support-code="counselor"]')).toBeNull();

    await settlePhysicalInput();
    await act(async () => pressPhysicalKey("Digit4"));
    expect(supporter.querySelector('[data-support-code="caregiver"]')).toBeNull();
    expect(supporter.querySelector('[data-support-code="counselor"]')).toBeNull();

    await settlePhysicalInput();
    await act(async () => pressPhysicalKey("Digit4"));
    const counselorCode = await findElement('[data-support-code="counselor"]');
    expect(counselorCode).toHaveTextContent(SUPPORT_CODE_PATTERN);
  });

  it("reveals caregiver and counselor codes by clicking their visible buttons", async () => {
    const caregiverRender = renderAt("#/connect");
    const caregiverScreen = await findElement('[data-screen="support-connection"]');
    const caregiverButton = within(caregiverScreen).getByRole("button", {
      name: CAREGIVER_CONNECTION_LABEL,
    });

    fireEvent.click(caregiverButton);
    expect(await findElement('[data-support-code="caregiver"]')).toHaveTextContent(
      SUPPORT_CODE_PATTERN,
    );
    caregiverRender.unmount();

    renderAt("#/connect");
    const counselorScreen = await findElement('[data-screen="support-connection"]');
    const counselorButton = within(counselorScreen).getByRole("button", {
      name: COUNSELOR_CONNECTION_LABEL,
    });

    fireEvent.click(counselorButton);
    expect(await findElement('[data-support-code="counselor"]')).toHaveTextContent(
      SUPPORT_CODE_PATTERN,
    );
  });
});
