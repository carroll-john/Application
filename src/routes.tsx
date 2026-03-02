import { Suspense, lazy } from "react";
import * as Sentry from "@sentry/react";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
} from "react-router-dom";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { ScrollToTop } from "./components/ScrollToTop";
import { useAuth } from "./context/AuthContext";
import AuthCallback from "./pages/AuthCallback";
import CourseList from "./pages/CourseList";
import ApplicantProfile from "./pages/ApplicantProfile";
import CourseDetails from "./pages/CourseDetails";
import SignIn from "./pages/SignIn";
import { isSentryEnabled } from "./lib/sentry";
import { useLocation } from "react-router-dom";

const ApplicationSubmitted = lazy(() => import("./pages/ApplicationSubmitted"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DevSentrySmoke = import.meta.env.DEV
  ? lazy(() => import("./pages/DevSentrySmoke"))
  : null;
const Overview = lazy(() => import("./pages/Overview"));
const ProfileRecommendations = lazy(
  () => import("./pages/ProfileRecommendations"),
);
const ReviewAndSubmit = lazy(() => import("./pages/ReviewAndSubmit"));
const Section1BackgroundInfo = lazy(
  () => import("./pages/Section1BackgroundInfo"),
);
const Section1BasicInfo = lazy(() => import("./pages/Section1BasicInfo"));
const Section1ContactDetails = lazy(
  () => import("./pages/Section1ContactDetails"),
);
const Section1ContactInfo = lazy(() => import("./pages/Section1ContactInfo"));
const Section1CulturalBackground = lazy(
  () => import("./pages/Section1CulturalBackground"),
);
const Section1PersonalContact = lazy(
  () => import("./pages/Section1PersonalContact"),
);
const Section2AddAccreditation = lazy(
  () => import("./pages/Section2AddAccreditation"),
);
const Section2AddCV = lazy(() => import("./pages/Section2AddCV"));
const Section2AddEmployment = lazy(
  () => import("./pages/Section2AddEmployment"),
);
const Section2AddLanguageTest = lazy(
  () => import("./pages/Section2AddLanguageTest"),
);
const Section2AddSecondary = lazy(() => import("./pages/Section2AddSecondary"));
const Section2AddTertiary = lazy(() => import("./pages/Section2AddTertiary"));
const Section2Qualifications = lazy(
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
  ...(DevSentrySmoke
    ? [
        {
          path: "/dev/sentry-smoke",
          element: <DevSentrySmoke />,
        },
      ]
    : []),
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
]);
