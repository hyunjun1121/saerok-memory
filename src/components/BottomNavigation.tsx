import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { twMerge } from "tailwind-merge";
import { FileText, Home, TreePine } from "lucide-react";

export interface BottomNavigationProps {
  className?: string;
}

export function BottomNavigation({ className }: BottomNavigationProps) {
  const { t } = useTranslation();
  const location = useLocation();

  const navItems = [
    {
      id: "home",
      path: "/",
      label: t("navigation.home"),
      icon: <Home className="w-8 h-8" strokeWidth={2.5} />,
    },
    {
      id: "garden",
      path: "/garden",
      label: t("navigation.garden"),
      icon: <TreePine className="w-8 h-8" strokeWidth={2.5} />,
    },
    {
      id: "family",
      path: "/family",
      label: t("navigation.family"),
      icon: <FileText className="w-8 h-8" strokeWidth={2.5} />,
    },
  ];

  return (
    <nav
      className={twMerge(
        "fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 bg-white border-x border-t-2 border-gray-200 pb-safe",
        className
      )}
    >
      <div className="flex justify-around items-center h-20 px-4 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
                          (item.path !== "/" && location.pathname.startsWith(item.path));

          return (
            <Link
              key={item.id}
              to={item.path}
              className={twMerge(
                "flex flex-col items-center justify-center gap-1 w-full h-full transition-colors",
                isActive ? "text-primary-600" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <div
                className={twMerge(
                  "p-1.5 rounded-xl transition-all",
                  isActive ? "bg-primary-50 text-primary-600" : "bg-transparent text-gray-400"
                )}
              >
                {item.icon}
              </div>
              <span className="text-sm font-bold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
