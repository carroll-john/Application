import type { ReactNode } from "react";
import { AppBrandHeader } from "../../components/AppBrandHeader";
import { SurfaceCard } from "../../components/SurfaceCard";
import { Button } from "../../components/ui/button";

interface ProfilePageProps {
  children: ReactNode;
  onSignOut: () => void | Promise<void>;
  signedInLabel: string;
}

export function ProfilePage({
  children,
  onSignOut,
  signedInLabel,
}: ProfilePageProps) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppBrandHeader maxWidthClassName="max-w-5xl" />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold text-slate-950 sm:text-4xl">Profile</h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Update the reusable details you want to start new applications
              with. Existing applications keep the details they were created
              with.
            </p>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Signed in as {signedInLabel}
            </p>
          </div>
          <Button
            className="sm:min-w-[160px]"
            type="button"
            variant="outline"
            onClick={() => void onSignOut()}
          >
            Log out
          </Button>
        </div>

        {children}
      </div>
    </div>
  );
}

export function ProfileLoadingState() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppBrandHeader maxWidthClassName="max-w-5xl" />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <SurfaceCard className="w-full max-w-xl p-8 text-center text-slate-600">
          Loading your profile...
        </SurfaceCard>
      </div>
    </div>
  );
}
