import { useCallback, useState } from "react";
import {
  summarizeApplication,
  type ApplicationSummary,
} from "../../../lib/applicationRecords";
import type { ApplicationData } from "../../../lib/applicationData";

export function useApplicationSummaries() {
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);

  const upsertSummary = useCallback((application: ApplicationData) => {
    const summary = summarizeApplication(application);

    if (!summary) {
      return;
    }

    setApplications((previous) => {
      const next = previous.filter((item) => item.id !== summary.id);
      return [summary, ...next].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
    });
  }, []);

  return {
    applications,
    setApplications,
    upsertSummary,
  };
}
