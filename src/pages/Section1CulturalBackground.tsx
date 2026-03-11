import { BookOpen, Languages, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApplicationShell } from "../components/ApplicationShell";
import { FormSectionCard } from "../components/FormSectionCard";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { useReviewReturn } from "../hooks/useReviewReturn";
import { languages } from "../lib/formOptions";

export default function Section1CulturalBackground() {
  const navigate = useNavigate();
  const { fromReview, previousLabel, returnPath } = useReviewReturn();
  const { data, updateContactDetails } = useApplication();
  const [formData, setFormData] = useState({
    language: data.contactDetails.language,
    aboriginal: data.contactDetails.aboriginal,
    schoolLevel: data.contactDetails.schoolLevel,
  });

  const persist = () => updateContactDetails(formData);

  return (
    <ApplicationShell
      sectionLabel="Section 1 of 3"
      progress={67}
      title="Cultural and education background"
      description="These questions support government reporting and student support planning. They do not affect your admission outcome."
      onPrevious={() => {
        persist();
        navigate(returnPath("/section1/address"));
      }}
      onSaveAndExit={
        fromReview
          ? undefined
          : () => {
              persist();
              navigate("/dashboard");
            }
      }
      onContinue={() => {
        persist();
        navigate(returnPath("/section1/family-support"));
      }}
      previousLabel={previousLabel}
      continueLabel={fromReview ? "Save & Return to Review" : "Continue"}
    >
      <div className="grid gap-6">
        <FormSectionCard
          className="rounded-[30px] border-slate-200 p-5 sm:p-6"
          icon={<Languages className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />}
          title="Language spoken at home"
          description="We use this for reporting and to understand whether support services may help. It does not replace any English language evidence your course may require."
        >
          <Label htmlFor="language">Language *</Label>
          <NativeSelect
            id="language"
            value={formData.language}
            onChange={(event) =>
              setFormData((previous) => ({
                ...previous,
                language: event.target.value,
              }))
            }
          >
            <option value="">Select language</option>
            {languages.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </NativeSelect>
        </FormSectionCard>

        <FormSectionCard
          className="rounded-[30px] border-slate-200 p-5 sm:p-6"
          icon={<Users className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />}
          title="Aboriginal or Torres Strait Islander status"
          description="This is collected for government reporting only and does not affect admission decisions."
        >
          <Label htmlFor="aboriginal">Status *</Label>
          <NativeSelect
            id="aboriginal"
            value={formData.aboriginal}
            onChange={(event) =>
              setFormData((previous) => ({
                ...previous,
                aboriginal: event.target.value,
              }))
            }
          >
            <option value="">Select status</option>
            <option value="No">No</option>
            <option value="Aboriginal">Aboriginal</option>
            <option value="Torres Strait Islander">Torres Strait Islander</option>
            <option value="Both">Both</option>
          </NativeSelect>
        </FormSectionCard>

        <FormSectionCard
          className="rounded-[30px] border-slate-200 p-5 sm:p-6"
          icon={<BookOpen className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />}
          title="Highest school level completed"
          description="This is separate from your qualifications history and helps us understand your education background for reporting."
        >
          <Label htmlFor="schoolLevel">School level *</Label>
          <NativeSelect
            id="schoolLevel"
            value={formData.schoolLevel}
            onChange={(event) =>
              setFormData((previous) => ({
                ...previous,
                schoolLevel: event.target.value,
              }))
            }
          >
            <option value="">Select level</option>
            <option value="Year 12 or equivalent">Year 12 or equivalent</option>
            <option value="Year 11">Year 11</option>
            <option value="Year 10">Year 10</option>
            <option value="Did not complete Year 10">Did not complete Year 10</option>
          </NativeSelect>
        </FormSectionCard>
      </div>
    </ApplicationShell>
  );
}
