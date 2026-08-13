import type { ReactNode } from "react";
import { getBuildLanguage, getUiCopy } from "@/i18n/copy";
import { PhysicalButtonGuide, type GuideItem } from "@/components/PhysicalButtonGuide";
import type { ButtonSlot } from "@/features/input/types";

export interface AppFrameProps {
  children: ReactNode;
  guideItems: readonly [GuideItem, GuideItem, GuideItem, GuideItem];
  activeSlot?: ButtonSlot | null;
  dayLabel?: string;
  reserveLessonBottomSpace?: boolean;
}

export function AppFrame({
  children,
  guideItems,
  activeSlot,
  dayLabel,
  reserveLessonBottomSpace = false,
}: AppFrameProps) {
  const language = getBuildLanguage();
  const logo = "/assets/haru/haru_logo_color.png";
  return (
    <div
      className={`offline-app${reserveLessonBottomSpace ? " offline-app--lesson-spacing" : ""}`}
      data-market={language === "ja" ? "jp" : "kr"}
    >
      <div className="offline-app__stage">
        <header className="screen-header">
          <img className="screen-header__logo" src={logo} alt={getUiCopy(language, "appName")} />
          <div className="screen-header__brand">
            <span>{getUiCopy(language, "brandLine")}</span>
          </div>
          <div className="screen-header__day">{dayLabel ?? getUiCopy(language, "buttonLabel")}</div>
        </header>
        <main className="screen-main">{children}</main>
        <PhysicalButtonGuide
          title={getUiCopy(language, "guideTitle")}
          items={guideItems}
          activeSlot={activeSlot}
        />
      </div>
    </div>
  );
}
