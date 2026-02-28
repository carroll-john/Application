import { Smile, User } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApplicationShell } from "../components/ApplicationShell";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { useReviewReturn } from "../hooks/useReviewReturn";

export default function Section1BasicInfo() {
  const navigate = useNavigate();
  const { fromReview, previousLabel, returnPath } = useReviewReturn();
  const { data, updatePersonalDetails } = useApplication();
  const [formData, setFormData] = useState({
    title: data.personalDetails.title,
    firstName: data.personalDetails.firstName,
    middleName: data.personalDetails.middleName,
    lastName: data.personalDetails.lastName,
    preferredName: data.personalDetails.preferredName,
  });

  const persist = () => updatePersonalDetails(formData);

  return (
    <ApplicationShell
      sectionLabel="Section 1 of 3"
      progress={17}
      title="Your basic information"
      description="Let's start with some basic details about you."
      onPrevious={() => {
        persist();
        navigate(returnPath("/overview"));
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
        navigate(returnPath("/section1/personal-contact"));
      }}
      previousLabel={previousLabel}
      continueLabel={fromReview ? "Save & Return to Review" : "Continue"}
    >
      <div className="space-y-6">
        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <User className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Legal name</h2>
              <p className="text-sm text-slate-600">
                Your name as it appears on official documents.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <Label htmlFor="title">Title *</Label>
              <NativeSelect
                id="title"
                value={formData.title}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    title: event.target.value,
                  }))
                }
              >
                <option value="">Select title</option>
                <option value="Mr">Mr</option>
                <option value="Mrs">Mrs</option>
                <option value="Ms">Ms</option>
                <option value="Dr">Dr</option>
                <option value="Prof">Prof</option>
              </NativeSelect>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">First name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      firstName: event.target.value,
                    }))
                  }
                  placeholder="Enter your first name"
                />
              </div>
              <div>
                <Label htmlFor="middleName">Middle name</Label>
                <Input
                  id="middleName"
                  value={formData.middleName}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      middleName: event.target.value,
                    }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="lastName">Last name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    lastName: event.target.value,
                  }))
                }
                placeholder="Enter your last name"
              />
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <Smile className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Preferred name
              </h2>
              <p className="text-sm text-slate-600">
                The name you'd like us to use when we communicate with you.
              </p>
            </div>
          </div>

          <Label htmlFor="preferredName">Preferred name</Label>
          <Input
            id="preferredName"
            value={formData.preferredName}
            onChange={(event) =>
              setFormData((previous) => ({
                ...previous,
                preferredName: event.target.value,
              }))
            }
            placeholder="Optional"
          />
        </div>
      </div>
    </ApplicationShell>
  );
}
