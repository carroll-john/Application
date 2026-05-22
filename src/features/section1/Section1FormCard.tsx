import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";
import { FormSectionCard } from "../forms/layout";

const SECTION1_CARD_CLASSNAME = "rounded-[30px] border-slate-200 p-5 sm:p-6";

type Section1FormCardProps = Omit<ComponentProps<typeof FormSectionCard>, "className"> & {
  className?: string;
};

export function Section1FormCard({
  className,
  ...props
}: Section1FormCardProps) {
  return (
    <FormSectionCard
      className={cn(SECTION1_CARD_CLASSNAME, className)}
      {...props}
    />
  );
}
