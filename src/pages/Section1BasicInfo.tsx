import { Smile, User } from "lucide-react";
import { useState } from "react";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { Section1FormCard, Section1StepPage } from "../features/section1";

export default function Section1BasicInfo() {
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
    <Section1StepPage step="basic-info" persist={persist}>
      <div className="space-y-6">
        <Section1FormCard
          description="Your name as it appears on official documents."
          icon={<User className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
          title="Legal name"
        >
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
        </Section1FormCard>

        <Section1FormCard
          description="The name you'd like us to use when we communicate with you."
          icon={<Smile className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
          title="Preferred name"
        >
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
        </Section1FormCard>
      </div>
    </Section1StepPage>
  );
}
