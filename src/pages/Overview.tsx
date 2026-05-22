import { useLocation, useNavigate } from "react-router-dom";
import { useApplication } from "../context/ApplicationContext";
import { OverviewPage } from "../features/overview";
import {
  getSelectedCourse,
  isApplicationSubmitted,
} from "../lib/applicationProgress";
import { getOverviewActionDescriptor } from "../lib/overviewAction";
import { captureApplicationStepEvent } from "../lib/posthog";

export default function Overview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data, getNextIncompleteSection } = useApplication();
  const submitted = isApplicationSubmitted(data);
  const selectedCourse = getSelectedCourse(data.applicationMeta);
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
      intakeLabel={selectedCourse.intakeLabel}
      nextAction={nextAction}
      prefilledFrom={data.applicationMeta.prefilledFrom}
      title={selectedCourse.title}
      onContinue={handleContinue}
    />
  );
}
