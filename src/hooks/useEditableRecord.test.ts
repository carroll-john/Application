import { describe, expect, it } from "vitest";
import { resolveEditableRecord } from "./useEditableRecord";

describe("resolveEditableRecord", () => {
  const items = [
    { id: "record-1", name: "First" },
    { id: "record-2", name: "Second" },
  ];

  it("bootstraps a new record when no id is present", () => {
    const result = resolveEditableRecord(items, undefined, () => ({
      id: "new-id",
      name: "",
    }));

    expect(result.existing).toBeUndefined();
    expect(result.isEditing).toBe(false);
    expect(result.initialRecord).toEqual({ id: "new-id", name: "" });
  });

  it("loads an existing record when the route id matches", () => {
    const result = resolveEditableRecord(items, "record-2", () => ({
      id: "new-id",
      name: "",
    }));

    expect(result.existing).toEqual({ id: "record-2", name: "Second" });
    expect(result.isEditing).toBe(true);
    expect(result.initialRecord).toEqual({ id: "record-2", name: "Second" });
  });

  it("falls back to a default record when the route id is unknown", () => {
    const result = resolveEditableRecord(items, "missing", () => ({
      id: "new-id",
      name: "",
    }));

    expect(result.existing).toBeUndefined();
    expect(result.isEditing).toBe(false);
    expect(result.initialRecord).toEqual({ id: "new-id", name: "" });
  });
});
