import { Lightbulb, ListChecks, Sparkles, Target } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AccentIconBadge } from "../components/AccentIconBadge";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { useApplication } from "../context/ApplicationContext";

export default function ProfileRecommendations() {
  const navigate = useNavigate();
  const { data } = useApplication();

  const recommendations = [
    "Highlight leadership outcomes in your employment history.",
    "Attach one additional academic transcript if available.",
    "Provide more detail on the scope of your current role.",
  ];

  return (
    <div className="min-h-screen bg-[#f7f7f4]">
      <AppBrandHeader maxWidthClassName="max-w-5xl" />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <SurfaceCard className="rounded-[36px] border-0 bg-[linear-gradient(135deg,#1f3f58_0%,#084E74_100%)] p-6 text-white shadow-[0_24px_50px_rgba(8,78,116,0.25)] sm:p-8">
          <AccentIconBadge tone="inverseSoft">
            <Sparkles className="h-6 w-6" />
          </AccentIconBadge>
          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
            Profile recommendations
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-100">
            Based on the information you have entered, here are a few ways to
            strengthen the story your application tells.
          </p>
        </SurfaceCard>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <RecommendationCard
            icon={<Target className="h-6 w-6" />}
            title="Application fit"
            body={
              data.employmentExperiences.length > 0
                ? "Your work history already signals professional readiness for the MBA."
                : "Adding at least one professional role will better demonstrate career momentum."
            }
          />
          <RecommendationCard
            icon={<ListChecks className="h-6 w-6" />}
            title="Evidence coverage"
            body={
              data.cvUploaded
                ? "Your CV is already attached. Consider adding a second supporting document for depth."
                : "Upload your CV to improve evidence coverage before submission."
            }
          />
          <RecommendationCard
            icon={<Lightbulb className="h-6 w-6" />}
            title="Narrative clarity"
            body="Use clear, measurable examples in employment duties to show impact, leadership and progression."
          />
        </div>

        <SurfaceCard className="mt-8 p-6">
          <h2 className="text-xl font-bold text-slate-900">
            Suggested next steps
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            {recommendations.map((recommendation) => (
              <li key={recommendation} className="flex items-start gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-[#F4CF0A]" />
                <span>{recommendation}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => navigate("/review")}>Return to review</Button>
            <Button onClick={() => navigate("/dashboard")} variant="outline">
              Back to dashboard
            </Button>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

function RecommendationCard({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <SurfaceCard className="rounded-[30px] p-6">
      <AccentIconBadge tone="accentSoft">
        {icon}
      </AccentIconBadge>
      <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
    </SurfaceCard>
  );
}
