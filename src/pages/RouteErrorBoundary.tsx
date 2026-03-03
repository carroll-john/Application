import { useNavigate, useRouteError, isRouteErrorResponse } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { isRecoverableRouteChunkError } from "../lib/routeChunkRecovery";

function getRouteErrorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`.trim();
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "";
}

export default function RouteErrorBoundary() {
  const navigate = useNavigate();
  const error = useRouteError();
  const errorMessage = getRouteErrorMessage(error);
  const isChunkError = isRecoverableRouteChunkError(error);

  return (
    <div className="min-h-screen bg-[#f7f7f4]">
      <AppBrandHeader maxWidthClassName="max-w-5xl" />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <SurfaceCard className="p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#084E74]">
            {isChunkError ? "Application updated" : "Something went wrong"}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            {isChunkError ? "Refresh to keep going" : "We couldn't load this step"}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            {isChunkError
              ? "This page was open during a deployment, so your browser is still pointing at an older app bundle. Refresh to load the latest version and continue your application."
              : "Try reloading the page. If the problem keeps happening, head back to the course catalog and re-enter the flow."}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => window.location.reload()}>
              {isChunkError ? "Reload page" : "Try again"}
            </Button>
            <Button
              variant="neutralOutline"
              onClick={() => navigate("/", { replace: true })}
            >
              Return to courses
            </Button>
          </div>

          {errorMessage && !isChunkError ? (
            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              {errorMessage}
            </div>
          ) : null}
        </SurfaceCard>
      </div>
    </div>
  );
}
