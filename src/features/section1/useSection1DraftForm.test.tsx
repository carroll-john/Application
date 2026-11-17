import { useState } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useSection1DraftForm } from "./useSection1DraftForm";

function DraftValue({
  isHydrating,
  source,
}: {
  isHydrating: boolean;
  source: string;
}) {
  const [value] = useSection1DraftForm(source, isHydrating);
  return createElement("input", { readOnly: true, value });
}

function HydrationHarness() {
  const [phase, setPhase] = useState<
    "loading" | "loaded" | "editing" | "refreshing" | "refreshed"
  >("loading");

  if (phase === "loading") setPhase("loaded");

  const isHydrating = phase === "loading" || phase === "refreshing";
  const source =
    phase === "refreshed"
      ? "Server overwrite"
      : phase === "loading" || phase === "refreshing"
        ? ""
        : "Ada Lovelace";
  const [value, setValue] = useSection1DraftForm(source, isHydrating);

  if (phase === "loaded" && value === "Ada Lovelace") {
    setValue("Ada edited");
    setPhase("editing");
  }

  if (phase === "editing") setPhase("refreshing");
  if (phase === "refreshing") setPhase("refreshed");

  return createElement("input", { readOnly: true, value });
}

describe("useSection1DraftForm", () => {
  it("keeps a draft that was already loaded when the form mounted", () => {
    const html = renderToStaticMarkup(
      createElement(DraftValue, { isHydrating: false, source: "Ada Lovelace" }),
    );

    expect(html).toContain('value="Ada Lovelace"');
  });

  it("replaces the empty mount snapshot once hydration finishes and then keeps edits", () => {
    const html = renderToStaticMarkup(createElement(HydrationHarness));

    expect(html).toContain('value="Ada edited"');
  });
});
