import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApplication } from "../context/ApplicationContext";
import { useAuth } from "../context/AuthContext";
import {
  ApplicationList,
  DashboardPage,
  DashboardTabs,
  getDashboardTabDefinition,
  type DashboardTab,
} from "../features/dashboard";
import { capturePostHogEvent } from "../lib/posthog";

export default function Dashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const {
    activeApplicationId,
    applicantProfile,
    applications,
    openApplication,
  } = useApplication();
  const [activeTab, setActiveTab] = useState<DashboardTab>("all");
  const applicantName =
    [applicantProfile?.firstName, applicantProfile?.lastName]
      .map((name) => name?.trim())
      .filter(Boolean)
      .join(" ") || "Applicant";

  const filteredApplications = useMemo(() => {
    if (activeTab === "all") {
      return applications;
    }

    return applications.filter((application) => application.status === activeTab);
  }, [activeTab, applications]);

  const tabCounts = useMemo(
    () => ({
      all: applications.length,
      draft: applications.filter((application) => application.status === "draft")
        .length,
      submitted: applications.filter(
        (application) => application.status === "submitted",
      ).length,
    }),
    [applications],
  );

  const activeTabDefinition = getDashboardTabDefinition(activeTab);

  return (
    <DashboardPage
      subtitle={
        applicantProfile
          ? "Your profile is ready. Start a new course application or continue an open one below."
          : "Browse courses, pass eligibility, and start an application from the course page."
      }
      userDisplayName={applicantName}
      onBrowseCourses={() => navigate("/")}
      onSignOut={async () => {
        await signOut();
        navigate("/");
      }}
    >
      <DashboardTabs
        activeTab={activeTab}
        tabCounts={tabCounts}
        onSelectTab={setActiveTab}
      />
      <ApplicationList
        activeApplicationId={activeApplicationId}
        activeTabDefinition={activeTabDefinition}
        applications={filteredApplications}
        onBrowseCourses={() => navigate("/")}
        onOpenApplication={async (application) => {
          capturePostHogEvent("application_opened_from_dashboard", {
            application_id: application.id,
            application_number: application.applicationNumber ?? null,
            application_status: application.status,
            course_code: application.course.code,
            course_intake: application.course.intake,
            course_provider: application.course.provider,
            course_title: application.course.title,
            is_active_application: application.id === activeApplicationId,
          });
          await openApplication(application.id);
          navigate(
            application.status === "submitted" ? "/submitted" : "/overview",
          );
        }}
        onViewCourse={(application) => navigate(`/courses/${application.course.code}`)}
      />
    </DashboardPage>
  );
}
