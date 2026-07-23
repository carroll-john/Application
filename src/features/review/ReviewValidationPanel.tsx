import { Edit } from "lucide-react";
import { Button } from "../../components/ui/button";
import type { ValidationIssue } from "../../lib/applicationValidationSchema";

interface ReviewValidationPanelProps {
  groupedErrors: Record<string, Record<string, ValidationIssue[]>>;
  onEdit: (path: string) => void;
}

export function ReviewValidationPanel({
  groupedErrors,
  onEdit,
}: ReviewValidationPanelProps) {
  return (
    <div className="content-block mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex-1">
        <p className="mb-2 font-semibold text-red-800">Required fields missing</p>
        <p className="mb-4 text-sm text-red-700">
          Please complete the following fields to submit your application:
        </p>
        <div className="mt-4 space-y-4">
          {Object.entries(groupedErrors).map(([section, subsections]) => (
            <div
              key={section}
              className="content-block-compact rounded border border-red-200 bg-white p-4"
            >
              <h3 className="text-base font-bold text-gray-900">{section}</h3>
              <div className="mt-3 space-y-3">
                {Object.entries(subsections).map(([subsection, errors]) => (
                  <div key={subsection} className="border-l-2 border-gray-200 pl-3">
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {subsection}
                      </p>
                      <Button
                        className="h-8 rounded-lg border border-gray-300 bg-white text-xs text-gray-700 shadow-none hover:bg-gray-50"
                        onClick={() => onEdit(errors[0].path)}
                        size="sm"
                      >
                        <Edit className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                    <div className="grid gap-x-4 gap-y-1 text-xs text-gray-600 sm:grid-cols-2">
                      {errors.map((error) => (
                        <div key={`${subsection}-${error.field}`}>
                          <span className="font-medium text-red-600">Required:</span>{" "}
                          {error.field}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
