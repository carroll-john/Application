import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/utils";
import { FormSectionCard } from "../forms/layout";

const SECTION2_CARD_CLASSNAME = "rounded-[30px] border-slate-200 p-5 sm:p-6";

type Section2FormCardProps = Omit<ComponentProps<typeof FormSectionCard>, "className"> & {
  className?: string;
};

export function Section2FormCard({
  className,
  ...props
}: Section2FormCardProps) {
  return (
    <FormSectionCard
      className={cn(SECTION2_CARD_CLASSNAME, className)}
      {...props}
    />
  );
}
