import { useLocation } from "react-router-dom";
import { useApplication } from "../context/ApplicationContext";
import { captureApplicationStepEvent, getApplicationStepDefinition } from "../lib/posthog";
import { Button, type ButtonProps } from "./ui/button";

interface FormActionBarProps {
  previousLabel: string;
  onPrevious: () => void;
  previousDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
  secondaryVariant?: ButtonProps["variant"];
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryVariant?: ButtonProps["variant"];
}

export function FormActionBar({
  previousLabel,
  onPrevious,
  previousDisabled = false,
  secondaryLabel,
  onSecondary,
  secondaryDisabled = false,
  secondaryVariant = "soft",
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryVariant = "default",
}: FormActionBarProps) {
  const location = useLocation();
  const { data } = useApplication();
  const hasSecondary = Boolean(secondaryLabel && onSecondary);
  const stepDefinition = getApplicationStepDefinition(location.pathname);

  function handlePrimaryClick() {
    if (stepDefinition && stepDefinition.group !== "review") {
      captureApplicationStepEvent("application_step_completed", {
        application: data,
        pathname: location.pathname,
        properties: {
          action_label: primaryLabel,
        },
      });
    }

    onPrimary();
  }

  function handleSecondaryClick() {
    if (stepDefinition) {
      captureApplicationStepEvent("application_saved_for_later", {
        application: data,
        pathname: location.pathname,
        properties: {
          action_label: secondaryLabel,
        },
      });
    }

    onSecondary?.();
  }

  return (
    <div
      className="mb-10 mt-6 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm"
      data-form-action-bar=""
    >
      <div className={hasSecondary ? "grid gap-3 sm:grid-cols-3" : "grid gap-3 sm:grid-cols-2"}>
        <Button
          className="order-3 w-full sm:order-1"
          disabled={previousDisabled}
          onClick={onPrevious}
          variant="outline"
        >
          {previousLabel}
        </Button>
        {hasSecondary ? (
          <Button
            className="order-2 w-full"
            disabled={secondaryDisabled}
            onClick={handleSecondaryClick}
            variant={secondaryVariant}
          >
            {secondaryLabel}
          </Button>
        ) : null}
        <Button
          className={hasSecondary ? "order-1 w-full sm:order-3" : "order-1 w-full sm:order-2"}
          disabled={primaryDisabled}
          onClick={handlePrimaryClick}
          variant={primaryVariant}
        >
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}
