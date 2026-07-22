import type { ReactNode } from "react";
import { BookOpen, CheckCircle2, Clock } from "lucide-react";

export type DashboardTab = "all" | "draft" | "submitted";

export interface DashboardTabDefinition {
  emptyBody: string;
  emptyTitle: string;
  icon: ReactNode;
  key: DashboardTab;
  label: string;
  tone: "all" | "submitted" | "draft";
}

export const dashboardTabs: DashboardTabDefinition[] = [
  {
    key: "all",
    label: "All applications",
    tone: "all",
    icon: <BookOpen className="h-5 w-5" />,
    emptyTitle: "No applications yet",
    emptyBody: "Start an application from a course page to see it here.",
  },
  {
    key: "draft",
    label: "Open",
    tone: "draft",
    icon: <Clock className="h-5 w-5" />,
    emptyTitle: "No open applications",
    emptyBody: "Applications still in progress will appear here.",
  },
  {
    key: "submitted",
    label: "Submitted",
    tone: "submitted",
    icon: <CheckCircle2 className="h-5 w-5" />,
    emptyTitle: "No submitted applications",
    emptyBody: "Submitted applications will appear here after final submission.",
  },
];

interface DashboardTabsProps {
  activeTab: DashboardTab;
  tabCounts: Record<DashboardTab, number>;
  onSelectTab: (tab: DashboardTab) => void;
}

export function DashboardTabs({
  activeTab,
  tabCounts,
  onSelectTab,
}: DashboardTabsProps) {
  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-3">
      {dashboardTabs.map((tab) => (
        <button
          key={tab.key}
          className={`content-block rounded-[28px] border-2 bg-white p-5 text-left shadow-sm transition-all ${
            activeTab === tab.key
              ? tab.tone === "draft"
                ? "border-[var(--sn-yellow)] ring-2 ring-[var(--sn-yellow)]/30"
                : tab.tone === "all"
                  ? "border-[var(--sn-navy)] ring-2 ring-[var(--sn-navy)]/20"
                  : "border-[var(--success-text)] ring-2 ring-[var(--success-border)]"
              : tab.tone === "draft"
                ? "border-slate-200 hover:border-[var(--sn-yellow)]/50"
                : tab.tone === "all"
                  ? "border-slate-200 hover:border-[var(--sn-mint)]"
                  : "border-slate-200 hover:border-[var(--success-border)]"
          }`}
          type="button"
          onClick={() => onSelectTab(tab.key)}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">{tab.label}</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">
                {tabCounts[tab.key]}
              </p>
            </div>
            <div className="rounded-full bg-slate-100 p-3 text-slate-600">
              {tab.icon}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function getDashboardTabDefinition(activeTab: DashboardTab) {
  return dashboardTabs.find((tab) => tab.key === activeTab) ?? dashboardTabs[0];
}
