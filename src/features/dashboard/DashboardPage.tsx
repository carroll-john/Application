import type { ReactNode } from "react";
import { AppBrandHeader } from "../../components/AppBrandHeader";
import { Button } from "../../components/ui/button";

interface DashboardPageProps {
  children: ReactNode;
  onBrowseCourses: () => void;
  onSignOut: () => void | Promise<void>;
  subtitle: string;
  userDisplayName: string;
}

export function DashboardPage({
  children,
  onBrowseCourses,
  onSignOut,
  subtitle,
  userDisplayName,
}: DashboardPageProps) {
  return (
    <div className="min-h-screen bg-[#f7f7f4]">
      <AppBrandHeader>
        <Button
          className="rounded-2xl shadow-none"
          onClick={() => void onSignOut()}
          variant="outline"
        >
          Log out
        </Button>
      </AppBrandHeader>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-950 sm:text-4xl">
              Welcome back, {userDisplayName}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              {subtitle}
            </p>
          </div>
          <Button onClick={onBrowseCourses} variant="outline">
            Browse courses
          </Button>
        </div>

        {children}
      </div>
    </div>
  );
}
