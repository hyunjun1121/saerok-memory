import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LifeBuoy } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { Button3D } from "@/components/Button3D";
import type { SupportResource } from "@/data/supportResources";

export interface SupportResourceCardProps {
  resources: SupportResource[];
  className?: string;
}

// Calm, action-oriented resource card (SP-09). When no verified resources are
// available it shows a gentle "pending verification" note and never invents
// phone numbers or addresses. The framing is consultation preparation, not
// diagnosis.
export function SupportResourceCard({ resources, className }: SupportResourceCardProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const verified = resources.filter(
    (resource) => resource.lastVerifiedAt && resource.sourceUrl,
  );

  return (
    <section
      className={twMerge(
        "flex flex-col gap-3 rounded-2xl border-2 border-teal-100 bg-teal-50 p-5",
        className,
      )}
      aria-label={t("support.title")}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-white p-2.5 text-teal-600 shadow-sm">
          <LifeBuoy className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-ink">{t("support.title")}</h2>
          <p className="text-base font-medium leading-relaxed text-teal-900">
            {t("support.body")}
          </p>
        </div>
      </div>

      <Button3D
        variant="neutral"
        fullWidth
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {t("support.viewButton")}
      </Button3D>

      {open && (
        <div className="flex flex-col gap-3">
          {verified.length === 0 ? (
            <p className="rounded-xl bg-white px-3 py-2 text-base font-medium leading-relaxed text-gray-700">
              {t("support.pending")}
            </p>
          ) : (
            verified.map((resource) => (
              <div
                key={resource.id}
                className="flex flex-col gap-1 rounded-xl bg-white px-3 py-3 text-base font-medium text-ink"
              >
                <p className="font-bold">{resource.name}</p>
                {resource.representativePhone && (
                  <p className="text-base font-bold">
                    {t("support.phoneLabel")}: {resource.representativePhone}
                  </p>
                )}
                {resource.homepageUrl && (
                  <a
                    href={resource.homepageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-teal-700 underline"
                  >
                    {t("support.homepageLabel")}
                  </a>
                )}
                {resource.region && (
                  <p className="text-gray-500">
                    {t("support.regionLabel")}: {resource.region}
                  </p>
                )}
              </div>
            ))
          )}
          <p className="text-sm font-medium leading-relaxed text-teal-800">
            {t("support.verifyNote")}
          </p>
        </div>
      )}
    </section>
  );
}
