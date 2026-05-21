import { formatIsoDateForDisplay } from "../../components/ui/date-controls";
import type { ApplicationData } from "../../lib/applicationData";
import { getAddressReviewItems } from "../../lib/reviewFormatters";
import { ReviewCard, ReviewGrid } from "./ReviewSections";

interface ReviewSection1SummaryProps {
  data: ApplicationData;
  onEdit: (path: string) => void;
}

export function ReviewSection1Summary({ data, onEdit }: ReviewSection1SummaryProps) {
  const parentCount = Number(data.contactDetails.parentsCount || 0);

  return (
    <>
      <ReviewCard
        onEdit={() => onEdit("/section1/basic-info?from=review")}
        title="Basic Information"
      >
        <ReviewGrid
          items={[
            ["Title", data.personalDetails.title],
            ["First name", data.personalDetails.firstName],
            ["Middle name", data.personalDetails.middleName || "Not provided"],
            ["Last name", data.personalDetails.lastName],
            ["Preferred name", data.personalDetails.preferredName || "Not provided"],
          ]}
        />
      </ReviewCard>

      <ReviewCard
        onEdit={() => onEdit("/section1/personal-contact?from=review")}
        title="Personal Contact Details"
      >
        <ReviewGrid
          items={[
            ["Gender", data.personalDetails.gender],
            [
              "Date of birth",
              formatIsoDateForDisplay(data.personalDetails.dateOfBirth),
            ],
            ["Email address", data.personalDetails.email],
            ["Phone number", data.personalDetails.phone],
          ]}
        />
      </ReviewCard>

      <ReviewCard
        onEdit={() => onEdit("/section1/contact-info?from=review")}
        title="Citizenship Information"
      >
        <ReviewGrid
          items={[
            ["Citizen country", data.contactDetails.citizenCountry],
            ["Birth country", data.contactDetails.birthCountry],
            [
              "Australian citizenship status",
              data.contactDetails.citizenshipStatus,
            ],
          ]}
        />
      </ReviewCard>

      <ReviewCard
        onEdit={() => onEdit("/section1/address?from=review")}
        title="Address Details"
      >
        <ReviewGrid
          items={[
            ...getAddressReviewItems(
              "Permanent residential address",
              data.contactDetails.residentialAddress,
            ),
            ...(data.contactDetails.postalDifferent
              ? getAddressReviewItems(
                  "Postal address",
                  data.contactDetails.postalAddress,
                )
              : []),
          ]}
        />
      </ReviewCard>

      <ReviewCard
        onEdit={() => onEdit("/section1/cultural-background?from=review")}
        title="Cultural & Education Background"
      >
        <ReviewGrid
          items={[
            ["Language spoken at home", data.contactDetails.language],
            [
              "Aboriginal or Torres Strait Islander status",
              data.contactDetails.aboriginal,
            ],
            ["Highest school level completed", data.contactDetails.schoolLevel],
          ]}
        />
      </ReviewCard>

      <ReviewCard
        onEdit={() => onEdit("/section1/family-support?from=review")}
        title="Family & Support Information"
      >
        <ReviewGrid
          items={[
            [
              "How many parents/guardians do you have?",
              data.contactDetails.parentsCount || "Not provided",
            ],
            ...([
              data.contactDetails.parent1Details,
              data.contactDetails.parent2Details,
              data.contactDetails.parent3Details,
              data.contactDetails.parent4Details,
              data.contactDetails.parent5Details,
            ]
              .slice(0, parentCount)
              .map(
                (value, index) =>
                  [
                    `Parent/Guardian ${index + 1} Education Level`,
                    value || "Not provided",
                  ] as [string, string],
              )),
            [
              "Do you have a disability, impairment or long-term condition?",
              data.contactDetails.hasDisability === null
                ? "Not provided"
                : data.contactDetails.hasDisability
                  ? "Yes"
                  : "No",
            ],
            ...(data.contactDetails.hasDisability
              ? [[
                  "Please provide details",
                  data.contactDetails.disabilityDetails || "Not provided",
                ] as [string, string]]
              : []),
          ]}
        />
      </ReviewCard>
    </>
  );
}
