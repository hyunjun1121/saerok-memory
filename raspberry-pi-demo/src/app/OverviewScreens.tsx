import { useCallback, useMemo, useRef, useState } from "react";
import { Flower2, HeartHandshake, HelpCircle, PlayCircle, UserRoundCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppFrame } from "@/components/AppFrame";
import type { GuideItem } from "@/components/PhysicalButtonGuide";
import { HARU_WEEK_PLAN } from "@/data/haru7DayExercises";
import { useFourButtonHandler, useFourButtonStatus } from "@/features/input";
import type { ButtonSlot } from "@/features/input/types";
import { getBuildLanguage, getUiCopy } from "@/i18n/copy";
import { getLocalizedText } from "@/utils/localizedText";

const slotOrder: readonly ButtonSlot[] = ["topLeft", "topRight", "bottomLeft", "bottomRight"];
const badges = ["A", "B", "C", "D"] as const;
const tones = ["red", "yellow", "green", "blue"] as const;

const isLeft = (slot: ButtonSlot) => slot === "topLeft" || slot === "bottomLeft";

function actionGuide(left: string, right: string): readonly [GuideItem, GuideItem, GuideItem, GuideItem] {
  return [
    { slot: "topLeft", badge: "A", tone: "red", label: left },
    { slot: "topRight", badge: "B", tone: "yellow", label: right },
    { slot: "bottomLeft", badge: "C", tone: "green", label: left },
    { slot: "bottomRight", badge: "D", tone: "blue", label: right },
  ];
}

interface MenuItem {
  label: string;
  path: string;
  icon: typeof PlayCircle;
}

function SpatialMenu({
  title,
  hint,
  items,
  screenId,
}: {
  title: string;
  hint: string;
  items: readonly MenuItem[];
  screenId: string;
}) {
  const navigate = useNavigate();
  const language = getBuildLanguage();
  const { activeSlot } = useFourButtonStatus();
  const [selected, setSelected] = useState<ButtonSlot | null>(null);
  const handleSlot = useCallback((slot: ButtonSlot) => {
    const index = slotOrder.indexOf(slot);
    const item = items[index];
    if (!item) return;
    if (selected === slot) {
      navigate(item.path);
      return;
    }
    setSelected(slot);
  }, [items, navigate, selected]);
  useFourButtonHandler(handleSlot);

  const guide = useMemo(() => slotOrder.map((slot, index) => ({
    slot,
    badge: badges[index],
    tone: tones[index],
    label: selected === slot ? getUiCopy(language, "sameButton") : getUiCopy(language, "directChoice"),
  })) as [GuideItem, GuideItem, GuideItem, GuideItem], [language, selected]);

  return (
    <AppFrame guideItems={guide} activeSlot={activeSlot}>
      <section className="spatial-menu" data-screen={screenId}>
        <div className="question-copy">
          <h1>{title}</h1>
          <p>{hint}</p>
        </div>
        <div className="menu-grid">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.path}
                className={`menu-tile ${selected === slotOrder[index] ? "is-selected" : ""}`}
                data-path={item.path}
              >
                <Icon aria-hidden="true" />
                <strong>{item.label}</strong>
              </div>
            );
          })}
        </div>
      </section>
    </AppFrame>
  );
}

export function KioskMenuScreen() {
  const language = getBuildLanguage();
  const items = useMemo<readonly MenuItem[]>(() => [
    { label: getUiCopy(language, "menuLesson"), path: "/lesson?restart=1", icon: PlayCircle },
    { label: getUiCopy(language, "menuSupportConnection"), path: "/connect", icon: UserRoundCheck },
    { label: getUiCopy(language, "menuFamily"), path: "/family", icon: HeartHandshake },
    { label: getUiCopy(language, "menuSettings"), path: "/settings", icon: HelpCircle },
  ], [language]);
  return <SpatialMenu title={getUiCopy(language, "menuTitle")} hint={getUiCopy(language, "menuHint")} items={items} screenId="kiosk-menu" />;
}

type SupportRole = "caregiver" | "counselor";

function createPairingCode(): string {
  const digits = new Uint16Array(8);
  globalThis.crypto.getRandomValues(digits);
  const value = Array.from(digits, (digit) => digit % 10).join("");
  return `${value.slice(0, 4)}-${value.slice(4)}`;
}

export function SupportConnectionScreen() {
  const language = getBuildLanguage();
  const navigate = useNavigate();
  const { activeSlot } = useFourButtonStatus();
  const [selectedRole, setSelectedRole] = useState<SupportRole | null>(null);
  const [revealedRole, setRevealedRole] = useState<SupportRole | null>(null);
  const [codes, setCodes] = useState<Partial<Record<SupportRole, string>>>({});
  const codesRef = useRef<Partial<Record<SupportRole, string>>>({});

  const reveal = useCallback((role: SupportRole) => {
    if (!codesRef.current[role]) {
      codesRef.current = { ...codesRef.current, [role]: createPairingCode() };
      setCodes(codesRef.current);
    }
    setSelectedRole(role);
    setRevealedRole(role);
  }, []);

  const handleSlot = useCallback((slot: ButtonSlot) => {
    if (isLeft(slot)) {
      navigate("/kiosk");
      return;
    }
    const role = slot === "topRight" ? "caregiver" : "counselor";
    if (selectedRole === role) {
      reveal(role);
      return;
    }
    setSelectedRole(role);
    setRevealedRole(null);
  }, [navigate, reveal, selectedRole]);
  useFourButtonHandler(handleSlot);

  const guide: readonly [GuideItem, GuideItem, GuideItem, GuideItem] = [
    { slot: "topLeft", badge: "A", tone: "red", label: getUiCopy(language, "back") },
    { slot: "topRight", badge: "B", tone: "yellow", label: getUiCopy(language, "connectCaregiver") },
    { slot: "bottomLeft", badge: "C", tone: "green", label: getUiCopy(language, "back") },
    { slot: "bottomRight", badge: "D", tone: "blue", label: getUiCopy(language, "connectCounselor") },
  ];

  const revealedCode = revealedRole ? codes[revealedRole] : undefined;
  const revealedLabel = revealedRole === "caregiver"
    ? getUiCopy(language, "connectCaregiver")
    : getUiCopy(language, "connectCounselor");

  return (
    <AppFrame guideItems={guide} activeSlot={activeSlot}>
      <section
        className={`support-connect${revealedRole ? " has-code" : ""}`}
        data-screen="support-connection"
      >
        <div className={`question-copy${revealedRole ? " support-connect__role-heading" : ""}`}>
          <h1>{revealedRole ? revealedLabel : getUiCopy(language, "supportConnectionTitle")}</h1>
          <p>
            {revealedRole
              ? getUiCopy(language, "connectCodeLabel")
              : getUiCopy(language, selectedRole ? "selectedHint" : "supportConnectionHint")}
          </p>
        </div>
        <div className="support-connect__actions">
          <button
            type="button"
            className={`support-connect__button${selectedRole === "caregiver" ? " is-selected" : ""}`}
            data-support-action="caregiver"
            aria-pressed={selectedRole === "caregiver"}
            onClick={() => reveal("caregiver")}
          >
            {getUiCopy(language, "connectCaregiver")}
          </button>
          <button
            type="button"
            className={`support-connect__button support-connect__button--secondary${selectedRole === "counselor" ? " is-selected" : ""}`}
            data-support-action="counselor"
            aria-pressed={selectedRole === "counselor"}
            onClick={() => reveal("counselor")}
          >
            {getUiCopy(language, "connectCounselor")}
          </button>
        </div>
        {revealedRole && revealedCode ? (
          <div className="support-connect__code-card" data-connect-role={revealedRole}>
            <output
              data-support-code={revealedRole}
              aria-label={`${revealedLabel} ${getUiCopy(language, "connectCodeLabel")} ${revealedCode}`}
            >
              {revealedCode}
            </output>
            <p>{getUiCopy(language, "connectCodeHint")}</p>
          </div>
        ) : null}
        <img className="support-connect__mascot" src="/assets/haru/mascot_turtle.jpg" alt="" />
      </section>
    </AppFrame>
  );
}

export function FamilyMenuScreen() {
  const language = getBuildLanguage();
  const items = useMemo<readonly MenuItem[]>(() => [
    { label: getUiCopy(language, "caregiverTitle"), path: "/connect/caregiver", icon: HeartHandshake },
    { label: getUiCopy(language, "counselorTitle"), path: "/connect/counselor", icon: HelpCircle },
    { label: getUiCopy(language, "participantTitle"), path: "/connect/counselor/participant/demo", icon: PlayCircle },
    { label: getUiCopy(language, "back"), path: "/kiosk", icon: Flower2 },
  ], [language]);
  return <SpatialMenu title={getUiCopy(language, "familyTitle")} hint={getUiCopy(language, "familyBody")} items={items} screenId="family-menu" />;
}

interface InfoScreenProps {
  title: string;
  body: string;
  image: string;
  nextPath: string;
}

export function InfoScreen({ title, body, image, nextPath }: InfoScreenProps) {
  const navigate = useNavigate();
  const language = getBuildLanguage();
  const { activeSlot } = useFourButtonStatus();
  const handleSlot = useCallback((slot: ButtonSlot) => {
    if (isLeft(slot)) navigate(-1);
    else navigate(nextPath);
  }, [navigate, nextPath]);
  useFourButtonHandler(handleSlot);
  return (
    <AppFrame
      guideItems={actionGuide(getUiCopy(language, "back"), getUiCopy(language, "next"))}
      activeSlot={activeSlot}
    >
      <section className="info-card">
        <img className="info-card__image" src={image} alt="" />
        <h1>{title}</h1>
        <p>{body}</p>
      </section>
    </AppFrame>
  );
}

interface PagedScreenProps {
  heading: string;
  intro: string;
  returnPath?: string;
}

export function PagedReportScreen({ heading, intro, returnPath = "/family" }: PagedScreenProps) {
  const navigate = useNavigate();
  const language = getBuildLanguage();
  const { activeSlot } = useFourButtonStatus();
  const [page, setPage] = useState(0);
  const plan = HARU_WEEK_PLAN[page];
  const handleSlot = useCallback((slot: ButtonSlot) => {
    if (isLeft(slot)) {
      if (page === 0) navigate(returnPath);
      else setPage((current) => current - 1);
      return;
    }
    if (page === HARU_WEEK_PLAN.length - 1) navigate(returnPath);
    else setPage((current) => current + 1);
  }, [navigate, page, returnPath]);
  useFourButtonHandler(handleSlot);
  return (
    <AppFrame
      guideItems={actionGuide(
        page === 0 ? getUiCopy(language, "back") : getUiCopy(language, "previousPage"),
        page === HARU_WEEK_PLAN.length - 1 ? getUiCopy(language, "finish") : getUiCopy(language, "nextPage"),
      )}
      activeSlot={activeSlot}
      dayLabel={getUiCopy(language, "day", { day: plan.day })}
    >
      <section className="info-card">
        <h1 className="report-heading">{heading}</h1>
        <span className="question-copy__eyebrow">{intro}</span>
        <h2 className="report-day-title">{getLocalizedText(plan.title, language)}</h2>
        <p>{getLocalizedText(plan.completionMessage, language)}</p>
        <p>{getUiCopy(language, "activityCount", { count: plan.recordedSummary.evaluatedActivities })}</p>
        <div className="route-pages" aria-label={getUiCopy(language, "pageOf", { current: page + 1, total: 7 })}>
          {HARU_WEEK_PLAN.map((entry, index) => <span key={entry.day} className={index === page ? "is-active" : ""} />)}
        </div>
      </section>
    </AppFrame>
  );
}

export function SettingsScreen() {
  const language = getBuildLanguage();
  const pages = [
    { title: getUiCopy(language, "settingsTitle"), body: getUiCopy(language, "settingsBody") },
    { title: getUiCopy(language, "buttonTest"), body: getUiCopy(language, "onboardingBody") },
    { title: getUiCopy(language, "soundReady"), body: getUiCopy(language, "privacyLocal") },
  ];
  return <StaticPages pages={pages} returnPath="/kiosk" image="/assets/haru/mascot_turtle.jpg" />;
}

export function OnboardingScreen() {
  const language = getBuildLanguage();
  const pages = [
    { title: getUiCopy(language, "onboardingTitle"), body: getUiCopy(language, "onboardingBody") },
    { title: getUiCopy(language, "buttonTest"), body: getUiCopy(language, "selectHint") },
    { title: getUiCopy(language, "voiceReady"), body: getUiCopy(language, "voiceReviewBody") },
  ];
  return <StaticPages pages={pages} returnPath="/kiosk" image="/assets/haru/mascot_turtle.jpg" />;
}

function StaticPages({ pages, returnPath, image }: { pages: readonly { title: string; body: string }[]; returnPath: string; image: string }) {
  const language = getBuildLanguage();
  const navigate = useNavigate();
  const { activeSlot } = useFourButtonStatus();
  const [page, setPage] = useState(0);
  const handleSlot = useCallback((slot: ButtonSlot) => {
    if (isLeft(slot)) {
      if (page === 0) navigate(returnPath);
      else setPage((current) => current - 1);
      return;
    }
    if (page === pages.length - 1) navigate(returnPath);
    else setPage((current) => current + 1);
  }, [navigate, page, pages.length, returnPath]);
  useFourButtonHandler(handleSlot);
  return (
    <AppFrame
      guideItems={actionGuide(page === 0 ? getUiCopy(language, "back") : getUiCopy(language, "previousPage"), page === pages.length - 1 ? getUiCopy(language, "finish") : getUiCopy(language, "nextPage"))}
      activeSlot={activeSlot}
    >
      <section className="info-card">
        <img className="info-card__image" src={image} alt="" />
        <h1>{pages[page].title}</h1>
        <p>{pages[page].body}</p>
        <div className="route-pages" style={{ gridTemplateColumns: `repeat(${pages.length}, 1fr)` }}>
          {pages.map((entry, index) => <span key={entry.title} className={index === page ? "is-active" : ""} />)}
        </div>
      </section>
    </AppFrame>
  );
}
