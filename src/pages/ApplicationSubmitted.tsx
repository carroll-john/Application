import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import AIAssessmentDemo from "../components/AIAssessmentDemo";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { FormSectionCard } from "../components/FormSectionCard";
import { Button } from "../components/ui/button";
import { useApplication } from "../context/ApplicationContext";
import { formatApplicationDate } from "../lib/applicationProgress";

export default function ApplicationSubmitted() {
  const navigate = useNavigate();
  const { data } = useApplication();
  const [showAIDemo, setShowAIDemo] = useState(false);
  const applicationNumber =
    data.applicationMeta.applicationNumber ?? "Application number pending";
  const submittedDate = formatApplicationDate(data.applicationMeta.submittedAt);

  return (
    <div className="min-h-screen bg-[#f7f7f4]">
      <AppBrandHeader>
        <Button
          className="rounded-2xl shadow-none"
          onClick={() => setShowAIDemo(true)}
          variant="soft"
        >
          <Sparkles className="h-4 w-4" />
          Run AI Assessment Demo
        </Button>
      </AppBrandHeader>

      {showAIDemo ? <AIAssessmentDemo onClose={() => setShowAIDemo(false)} /> : null}

      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#084E74_0%,#0b678f_55%,#084E74_100%)] text-white">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute right-10 top-10 h-64 w-64 rounded-full bg-[#F4CF0A] blur-3xl" />
          <div className="absolute bottom-10 left-10 h-48 w-48 rounded-full bg-sky-300 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 lg:px-8 lg:py-20">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-500 shadow-[0_18px_40px_rgba(34,197,94,0.35)]">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h1 className="mt-6 text-4xl font-bold sm:text-5xl">
            Application Successfully Submitted!
          </h1>
          <div className="mt-6 inline-block rounded-2xl border border-white/20 bg-white/10 px-6 py-3 backdrop-blur">
            <p className="text-sm text-white/75">Your application number</p>
            <p className="text-3xl font-bold text-[#F4CF0A]">{applicationNumber}</p>
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-100">
            Your application has been received and is now being reviewed by our
            admissions team.
          </p>
          {submittedDate ? (
            <p className="mt-3 text-sm text-slate-200">
              Submitted {submittedDate}
            </p>
          ) : null}
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold text-slate-900">
            What happens next
          </h2>
          <div className="mt-10 space-y-8">
            <TimelineStep
              description="We've received your application and sent a confirmation email to your registered address."
              icon={<CheckCircle2 className="h-6 w-6 text-white" />}
              subtitle="Confirmation email sent"
              subtitleIcon={<Mail className="h-4 w-4" />}
              title="Application received"
              tone="green"
            />
            <TimelineStep
              description="Our admissions team is currently reviewing your application and supporting documents."
              icon={<FileText className="h-6 w-6 text-slate-900" />}
              subtitle="Expected review time: 5 business days"
              subtitleIcon={<Clock className="h-4 w-4" />}
              title="Under review"
              tone="yellow"
            />
            <TimelineStep
              description="You'll receive an email notification with the outcome of your application. Track progress anytime from your dashboard."
              icon={<Mail className="h-6 w-6 text-white" />}
              title="Decision notification"
              tone="slate"
              terminal
            />
          </div>

          <div className="mt-12 text-center">
            <Button
              className="rounded-2xl px-8 py-6 text-base shadow-none"
              onClick={() => navigate("/dashboard")}
              variant="soft"
            >
              Go to dashboard
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-[#f7f7f4] py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900">Need help?</h2>
            <p className="mt-3 text-base text-slate-600">
              Our support team is here to assist you with any questions about
              your application.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <SupportCard
              action="support@studynext.com"
              icon={<Mail className="h-6 w-6 text-blue-600" />}
              title="Email support"
            />
            <SupportCard
              action="1300 123 456"
              icon={<Phone className="h-6 w-6 text-green-600" />}
              title="Phone support"
            />
            <SupportCard
              action="Start chat"
              icon={<MessageCircle className="h-6 w-6 text-amber-600" />}
              title="Live chat"
            />
          </div>
          <div className="mt-8 rounded-2xl border border-[var(--info-border)] bg-[var(--info-bg)] p-4 text-center text-sm text-[var(--info-text)]">
            <strong>Quote your Application Number ({applicationNumber})</strong> when
            contacting support for faster assistance.
          </div>
        </div>
      </section>
    </div>
  );
}

function TimelineStep({
  title,
  description,
  icon,
  subtitle,
  subtitleIcon,
  tone,
  terminal = false,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  subtitle?: string;
  subtitleIcon?: ReactNode;
  tone: "green" | "yellow" | "slate";
  terminal?: boolean;
}) {
  const toneClass =
    tone === "green"
      ? "bg-green-500"
      : tone === "yellow"
        ? "bg-[#F4CF0A]"
        : "bg-slate-300";

  return (
    <div className="flex gap-4 sm:gap-6">
      <div className="flex flex-col items-center">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${toneClass}`}>
          {icon}
        </div>
        {!terminal ? <div className="mt-2 h-full w-0.5 bg-slate-300" /> : null}
      </div>
      <div className="pb-8">
        <h3 className="text-xl font-bold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
          {description}
        </p>
        {subtitle ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-[var(--cta-secondary)]">
            {subtitleIcon}
            <span>{subtitle}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SupportCard({
  icon,
  title,
  action,
}: {
  icon: ReactNode;
  title: string;
  action: string;
}) {
  return (
    <FormSectionCard className="rounded-[30px] p-6 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-4 text-sm font-medium text-[var(--cta-secondary)]">{action}</p>
    </FormSectionCard>
  );
}
