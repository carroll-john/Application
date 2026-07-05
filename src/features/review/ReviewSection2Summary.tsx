import type { ApplicationData } from "../../lib/applicationData";
import { ReviewCard, ReviewDocumentRow, ReviewList } from "./ReviewSections";

interface ReviewSection2SummaryProps {
  data: ApplicationData;
  onEdit: (path: string) => void;
}

export function ReviewSection2Summary({ data, onEdit }: ReviewSection2SummaryProps) {
  return (
    <>
      {data.tertiaryQualifications.length > 0 ? (
        <ReviewCard title="Tertiary qualifications">
          <ReviewList
            items={data.tertiaryQualifications.map((qualification) => ({
              attachments: [
                qualification.transcriptDocumentName
                  ? {
                      fileName: qualification.transcriptDocumentName,
                      label: "Transcript",
                    }
                  : null,
                qualification.certificateDocumentName
                  ? {
                      fileName: qualification.certificateDocumentName,
                      label: "Certificate",
                    }
                  : null,
              ].filter(Boolean) as Array<{ fileName: string; label?: string }>,
              editPath: `/section2/edit-tertiary/${qualification.id}?from=review`,
              fallbackTitle: "Tertiary Qualification",
              fields: [
                ["Institution", qualification.institution],
                ["Country", qualification.country],
                ["Level", qualification.level],
                [
                  "Duration",
                  `${qualification.startMonth} ${qualification.startYear} - ${qualification.endMonth} ${qualification.endYear}`,
                ],
                ["Completed qualification", qualification.completed ? "Yes" : "No"],
              ],
              id: qualification.id,
              title: qualification.courseName,
            }))}
            onEdit={onEdit}
          />
        </ReviewCard>
      ) : null}

      {data.cvUploaded ? (
        <ReviewCard title="Curriculum Vitae (CV)">
          {data.cvFileName ? (
            <ReviewDocumentRow
              fileName={data.cvFileName}
              onEdit={() => onEdit("/section2/add-cv?from=review")}
            />
          ) : null}
        </ReviewCard>
      ) : null}

      {data.employmentExperiences.length > 0 ? (
        <ReviewCard title="Employment experience">
          <ReviewList
            items={data.employmentExperiences.map((experience) => ({
              detail: experience.duties ? (
                <div className="mt-3 border-t border-gray-200 pt-3">
                  <p className="text-gray-600">Key responsibilities</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {experience.duties}
                  </p>
                </div>
              ) : null,
              editPath: `/section2/edit-employment/${experience.id}?from=review`,
              fallbackTitle: "Employment Experience",
              fields: [
                ["Company", experience.company],
                ["Employment type", experience.type],
                [
                  "Duration",
                  `${experience.startMonth} ${experience.startYear} - ${
                    experience.currentRole
                      ? "Current"
                      : `${experience.endMonth} ${experience.endYear}`
                  }`,
                ],
                ["Current role", experience.currentRole ? "Yes" : "No"],
              ],
              id: experience.id,
              title: experience.position,
            }))}
            onEdit={onEdit}
          />
        </ReviewCard>
      ) : null}

      {data.professionalAccreditations.length > 0 ? (
        <ReviewCard
          onEdit={() => onEdit("/section2/qualifications?from=review")}
          title="Professional accreditations"
        >
          <ReviewList
            items={data.professionalAccreditations.map((accreditation) => ({
              attachments: accreditation.documentName
                ? [{ fileName: accreditation.documentName }]
                : [],
              editPath: `/section2/edit-accreditation/${accreditation.id}?from=review`,
              fallbackTitle: "Professional Accreditation",
              fields: [
                ["Name", accreditation.name],
                ["Status", accreditation.status],
              ],
              id: accreditation.id,
              title: accreditation.name,
            }))}
            onEdit={onEdit}
          />
        </ReviewCard>
      ) : null}

      {data.secondaryQualifications.length > 0 ? (
        <ReviewCard
          onEdit={() => onEdit("/section2/qualifications?from=review")}
          title="Secondary qualifications"
        >
          <ReviewList
            items={data.secondaryQualifications.map((qualification) => ({
              editPath: `/section2/edit-secondary/${qualification.id}?from=review`,
              fallbackTitle: "Secondary Qualification",
              fields: [
                ["Type", qualification.type],
                ["Country", qualification.country],
                ["State", qualification.state],
                ["School", qualification.school],
                ["Qualification obtained", qualification.qualification],
                ["Completion year", qualification.year],
              ],
              id: qualification.id,
              title: qualification.qualification,
            }))}
            onEdit={onEdit}
          />
        </ReviewCard>
      ) : null}

      {data.languageTests.length > 0 ? (
        <ReviewCard
          onEdit={() => onEdit("/section2/qualifications?from=review")}
          title="English language proficiency"
        >
          <ReviewList
            items={data.languageTests.map((test) => ({
              attachments: test.documentName ? [{ fileName: test.documentName }] : [],
              editPath: `/section2/edit-language-test/${test.id}?from=review`,
              fallbackTitle: "Language Test",
              fields: [
                ["Test type", test.type],
                ["Test name", test.name],
                ["Test year", test.year],
              ],
              id: test.id,
              title: test.name,
            }))}
            onEdit={onEdit}
          />
        </ReviewCard>
      ) : null}
    </>
  );
}
