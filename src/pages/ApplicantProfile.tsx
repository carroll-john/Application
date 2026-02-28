import { Mail, Phone, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useApplication } from "../context/ApplicationContext";
import { Label } from "../components/ui/label";
import {
  deriveApplicantProfileSeed,
  hasApplicantProfile,
} from "../lib/applicantProfiles";

export default function ApplicantProfile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data, updatePersonalDetails } = useApplication();
  const existingProfile = deriveApplicantProfileSeed(data);
  const [formData, setFormData] = useState({
    email: existingProfile?.email ?? data.personalDetails.email,
    firstName: existingProfile?.firstName ?? data.personalDetails.firstName,
    lastName: existingProfile?.lastName ?? data.personalDetails.lastName,
    preferredName:
      existingProfile?.preferredName ?? data.personalDetails.preferredName,
    phone: existingProfile?.phone ?? data.personalDetails.phone,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof formData, string>>>(
    {},
  );

  const redirectPath = useMemo(
    () => searchParams.get("redirect") || "/overview",
    [searchParams],
  );

  function validate() {
    const nextErrors: Partial<Record<keyof typeof formData, string>> = {};

    if (!formData.firstName.trim()) {
      nextErrors.firstName = "Enter the applicant's first name.";
    }

    if (!formData.lastName.trim()) {
      nextErrors.lastName = "Enter the applicant's last name.";
    }

    const email = formData.email.trim().toLowerCase();

    if (!email) {
      nextErrors.email = "Enter the applicant's email address.";
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      nextErrors.email = "Enter a valid applicant email address.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) {
      return;
    }

    updatePersonalDetails({
      email: formData.email.trim().toLowerCase(),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      preferredName: formData.preferredName.trim(),
      phone: formData.phone.trim(),
    });

    navigate(redirectPath, { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#f7f7f4] pb-10">
      <AppBrandHeader maxWidthClassName="max-w-5xl" />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-2 text-sm font-medium text-[var(--info-text)]">
            <UserRound className="h-4 w-4" />
            Applicant profile
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
            Set up the applicant you&apos;re testing
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Your Keypath work login keeps site access internal. This profile is
            the applicant record attached to the application and can use any
            email address.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <SurfaceCard className="p-6 sm:p-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-slate-950">
                  Applicant details
                </h2>
                <p className="text-sm leading-6 text-slate-600">
                  These details seed the application and create the applicant
                  profile in the backend. The full application form can still
                  refine them later.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="applicant-first-name">First name *</Label>
                  <Input
                    id="applicant-first-name"
                    value={formData.firstName}
                    onChange={(event) =>
                      setFormData((previous) => ({
                        ...previous,
                        firstName: event.target.value,
                      }))
                    }
                  />
                  {errors.firstName ? (
                    <p className="text-sm font-medium text-[var(--error-text)]">
                      {errors.firstName}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="applicant-last-name">Last name *</Label>
                  <Input
                    id="applicant-last-name"
                    value={formData.lastName}
                    onChange={(event) =>
                      setFormData((previous) => ({
                        ...previous,
                        lastName: event.target.value,
                      }))
                    }
                  />
                  {errors.lastName ? (
                    <p className="text-sm font-medium text-[var(--error-text)]">
                      {errors.lastName}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="applicant-email">Applicant email *</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="applicant-email"
                      className="pl-11"
                      inputMode="email"
                      value={formData.email}
                      onChange={(event) =>
                        setFormData((previous) => ({
                          ...previous,
                          email: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <p className="text-sm leading-6 text-slate-500">
                    This can be any valid applicant email domain. It does not
                    need to be a Keypath address.
                  </p>
                  {errors.email ? (
                    <p className="text-sm font-medium text-[var(--error-text)]">
                      {errors.email}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="applicant-preferred-name">
                    Preferred name
                  </Label>
                  <Input
                    id="applicant-preferred-name"
                    value={formData.preferredName}
                    onChange={(event) =>
                      setFormData((previous) => ({
                        ...previous,
                        preferredName: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="applicant-phone">Phone</Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="applicant-phone"
                      className="pl-11"
                      inputMode="tel"
                      value={formData.phone}
                      onChange={(event) =>
                        setFormData((previous) => ({
                          ...previous,
                          phone: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  className="sm:min-w-48"
                  variant="outline"
                  onClick={() => navigate("/")}
                >
                  Back to course
                </Button>
                <Button className="sm:min-w-56" onClick={handleSave}>
                  {hasApplicantProfile(data)
                    ? "Update Applicant Profile"
                    : "Save and Continue"}
                </Button>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="bg-[#E4EFEE] p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-slate-950">
              Why this exists
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-6 text-slate-700">
              <p>
                During dogfooding, only Keypath employees can enter the site.
              </p>
              <p>
                Inside the site, you still need a realistic applicant profile
                so applications, uploads, and future course matching are tied
                to the right person.
              </p>
              <p>
                When public launch comes, this applicant profile model stays in
                place and the outer Keypath-only gate can be removed.
              </p>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
