import { Suspense, useEffect } from "react";
import * as Sentry from "@sentry/react";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { ScrollToTop } from "./components/ScrollToTop";
import { useAuth } from "./context/AuthContext";
import { setClarityTag } from "./lib/clarity";
import AuthCallback from "./pages/AuthCallback";
import CourseList from "./pages/CourseList";
import ApplicantProfile from "./pages/ApplicantProfile";
import CourseDetails from "./pages/CourseDetails";
import SignIn from "./pages/SignIn";
import { isSentryEnabled } from "./lib/sentry";
import { lazyWithRetry } from "./lib/routeChunkRecovery";
import RouteErrorBoundary from "./pages/RouteErrorBoundary";

const ApplicationSubmitted = lazyWithRetry(
  "application-submitted",
  () => import("./pages/ApplicationSubmitted"),
);
const Dashboard = lazyWithRetry("dashboard", () => import("./pages/Dashboard"));
const DevSentrySmoke = import.meta.env.DEV
  ? lazyWithRetry("dev-sentry-smoke", () => import("./pages/DevSentrySmoke"))
  : null;
const Overview = lazyWithRetry("overview", () => import("./pages/Overview"));
const ProfileRecommendations = lazyWithRetry(
  "profile-recommendations",
  () => import("./pages/ProfileRecommendations"),
);
const ReviewAndSubmit = lazyWithRetry(
  "review-and-submit",
  () => import("./pages/ReviewAndSubmit"),
);
const Section1BackgroundInfo = lazyWithRetry(
  "section1-background-info",
  () => import("./pages/Section1BackgroundInfo"),
);
const Section1BasicInfo = lazyWithRetry(
  "section1-basic-info",
  () => import("./pages/Section1BasicInfo"),
);
const Section1ContactDetails = lazyWithRetry(
  "section1-contact-details",
  () => import("./pages/Section1ContactDetails"),
);
const Section1ContactInfo = lazyWithRetry(
  "section1-contact-info",
  () => import("./pages/Section1ContactInfo"),
);
const Section1CulturalBackground = lazyWithRetry(
  "section1-cultural-background",
  () => import("./pages/Section1CulturalBackground"),
);
const Section1PersonalContact = lazyWithRetry(
  "section1-personal-contact",
  () => import("./pages/Section1PersonalContact"),
);
const Section2AddAccreditation = lazyWithRetry(
  "section2-add-accreditation",
  () => import("./pages/Section2AddAccreditation"),
);
const Section2AddCV = lazyWithRetry("section2-add-cv", () => import("./pages/Section2AddCV"));
const Section2AddEmployment = lazyWithRetry(
  "section2-add-employment",
  () => import("./pages/Section2AddEmployment"),
);
const Section2AddLanguageTest = lazyWithRetry(
  "section2-add-language-test",
  () => import("./pages/Section2AddLanguageTest"),
);
const Section2AddSecondary = lazyWithRetry(
  "section2-add-secondary",
  () => import("./pages/Section2AddSecondary"),
);
const Section2AddTertiary = lazyWithRetry(
  "section2-add-tertiary",
  () => import("./pages/Section2AddTertiary"),
);
const Section2Qualifications = lazyWithRetry(
  "section2-qualifications",
  () => import("./pages/Section2Qualifications"),
);

function RouteLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7f4] px-4">
      <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm">
        <LoadingSpinner />
        <span>Loading next step...</span>
      </div>
    </div>
  );
}

function normalizeClarityRoute(pathname: string) {
  const normalizedPath = pathname
    .split("/")
    .map((segment) => {
      if (!segment) {
        return segment;
      }

      if (/^\d+$/.test(segment)) {
        return ":id";
      }

      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          segment,
        )
      ) {
        return ":id";
      }

      return segment;
    })
    .join("/");

  return normalizedPath || "/";
}

function ClarityRouteTracker() {
  const location = useLocation();

  useEffect(() => {
    setClarityTag("route", normalizeClarityRoute(location.pathname));
  }, [location.pathname]);

  return null;
}

function RootLayout() {
  return (
    <>
      <ClarityRouteTracker />
      <Outlet />
    </>
  );
}

function Layout() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteLoadingScreen />}>
        <Outlet />
      </Suspense>
    </>
  );
}

function AuthRequiredLayout() {
  const {
    isAuthorizedCompanyUser,
    isBypassedInDev,
    isConfigured,
    isLoading,
  } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <RouteLoadingScreen />;
  }

  if (isBypassedInDev) {
    return <Layout />;
  }

  if (!isConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f4] px-4">
        <div className="max-w-xl rounded-[32px] border border-[var(--warning-border)] bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">
            Authentication setup required
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Set `VITE_ALLOWED_EMAIL_DOMAINS` before deploying this app outside
            local development.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthorizedCompanyUser) {
    const redirect = `${location.pathname}${location.search}`;
    return (
      <Navigate
        replace
        to={`/sign-in?redirect=${encodeURIComponent(redirect)}`}
      />
    );
  }

  return <Layout />;
}

const createAppRouter = isSentryEnabled
  ? Sentry.wrapCreateBrowserRouterV7(createBrowserRouter)
  : createBrowserRouter;

export const router = createAppRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: "/dev/sentry-smoke",
        element: DevSentrySmoke ? <DevSentrySmoke /> : <Navigate replace to="/" />,
      },
      {
        path: "/",
        element: <CourseList />,
      },
      {
        path: "/courses/:courseCode",
        element: <CourseDetails />,
      },
      {
        path: "/sign-in",
        element: <SignIn />,
      },
      {
        path: "/auth/callback",
        element: <AuthCallback />,
      },
      {
        element: <AuthRequiredLayout />,
        children: [
          { path: "/profile", element: <ApplicantProfile /> },
          { path: "/applicant-profile", element: <Navigate replace to="/profile" /> },
          { path: "/overview", element: <Overview /> },
          { path: "/section1/basic-info", element: <Section1BasicInfo /> },
          {
            path: "/section1/personal-contact",
            element: <Section1PersonalContact />,
          },
          { path: "/section1/contact-info", element: <Section1ContactInfo /> },
          { path: "/section1/address", element: <Section1ContactDetails /> },
          {
            path: "/section1/cultural-background",
            element: <Section1CulturalBackground />,
          },
          { path: "/section1/family-support", element: <Section1BackgroundInfo /> },
          {
            path: "/section1/contact-details",
            element: <Navigate replace to="/section1/contact-info" />,
          },
          {
            path: "/section1/background-info",
            element: <Navigate replace to="/section1/family-support" />,
          },
          { path: "/section2/qualifications", element: <Section2Qualifications /> },
          { path: "/section2/add-tertiary", element: <Section2AddTertiary /> },
          { path: "/section2/edit-tertiary/:id", element: <Section2AddTertiary /> },
          { path: "/section2/add-employment", element: <Section2AddEmployment /> },
          {
            path: "/section2/edit-employment/:id",
            element: <Section2AddEmployment />,
          },
          {
            path: "/section2/add-accreditation",
            element: <Section2AddAccreditation />,
          },
          {
            path: "/section2/edit-accreditation/:id",
            element: <Section2AddAccreditation />,
          },
          { path: "/section2/add-secondary", element: <Section2AddSecondary /> },
          {
            path: "/section2/edit-secondary/:id",
            element: <Section2AddSecondary />,
          },
          {
            path: "/section2/add-language-test",
            element: <Section2AddLanguageTest />,
          },
          {
            path: "/section2/edit-language-test/:id",
            element: <Section2AddLanguageTest />,
          },
          { path: "/section2/add-cv", element: <Section2AddCV /> },
          { path: "/review", element: <ReviewAndSubmit /> },
          { path: "/submitted", element: <ApplicationSubmitted /> },
          { path: "/dashboard", element: <Dashboard /> },
          {
            path: "/profile-recommendations",
            element: <ProfileRecommendations />,
          },
        ],
      },
    ],
  },
]);
