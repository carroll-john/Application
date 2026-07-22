import { useLocation, useNavigate } from "react-router-dom";
import { useApplication } from "../context/ApplicationContext";
import { getUcCourseCardMedia } from "../features/course";
import { OverviewPage } from "../features/overview";
import {
  getSelectedCourse,
  isApplicationSubmitted,
} from "../lib/applicationProgress";
import { isUcBrand } from "../lib/brand";
import { getCourseCatalog } from "../lib/courseCatalog";
import { getOverviewActionDescriptor } from "../lib/overviewAction";
import { captureApplicationStepEvent } from "../lib/posthog";

export default function Overview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data, getNextIncompleteSection } = useApplication();
  const submitted = isApplicationSubmitted(data);
  const selectedCourse = getSelectedCourse(data.applicationMeta);
  const selectedCourseIndex = getCourseCatalog().findIndex(
    (course) => course.code === selectedCourse.code,
  );
  const courseMedia = isUcBrand
    ? getUcCourseCardMedia(selectedCourse, Math.max(selectedCourseIndex, 0))
    : undefined;
  const nextAction = getOverviewActionDescriptor(
    getNextIncompleteSection(),
    submitted,
  );

  function handleContinue() {
    captureApplicationStepEvent("application_step_completed", {
      application: data,
      pathname: location.pathname,
      properties: {
        action_label: nextAction.primaryLabel,
        next_path: nextAction.path,
      },
    });
    navigate(nextAction.path);
  }

  return (
    <OverviewPage
      course={selectedCourse}
      courseMedia={courseMedia}
      nextAction={nextAction}
      prefilledFrom={data.applicationMeta.prefilledFrom}
      onContinue={handleContinue}
    />
  );
}
