import { describe, expect, it, vi } from "vitest";
import { createSection2RecordSaveHandler } from "./useSection2RecordSave";

describe("createSection2RecordSaveHandler", () => {
  it("clears status, saves, and returns to qualifications on success", async () => {
    const saveRecord = vi.fn().mockResolvedValue(undefined);
    const returnToQualifications = vi.fn();
    const setStatusMessage = vi.fn();

    await createSection2RecordSaveHandler({
      returnToQualifications,
      saveRecord,
      setStatusMessage,
    });

    expect(setStatusMessage).toHaveBeenCalledWith(null);
    expect(saveRecord).toHaveBeenCalledTimes(1);
    expect(returnToQualifications).toHaveBeenCalledTimes(1);
  });

  it("stops when beforeContinue returns false", async () => {
    const saveRecord = vi.fn();
    const returnToQualifications = vi.fn();
    const setStatusMessage = vi.fn();
    const beforeContinue = vi.fn().mockReturnValue(false);

    await createSection2RecordSaveHandler({
      beforeContinue,
      returnToQualifications,
      saveRecord,
      setStatusMessage,
    });

    expect(setStatusMessage).toHaveBeenCalledWith(null);
    expect(beforeContinue).toHaveBeenCalledTimes(1);
    expect(saveRecord).not.toHaveBeenCalled();
    expect(returnToQualifications).not.toHaveBeenCalled();
  });

  it("sets an error status when saveRecord throws", async () => {
    const saveRecord = vi.fn().mockRejectedValue(new Error("upload failed"));
    const returnToQualifications = vi.fn();
    const setStatusMessage = vi.fn();

    await createSection2RecordSaveHandler({
      errorFallbackMessage: "Custom save error",
      returnToQualifications,
      saveRecord,
      setStatusMessage,
    });

    expect(saveRecord).toHaveBeenCalledTimes(1);
    expect(returnToQualifications).not.toHaveBeenCalled();
    expect(setStatusMessage).toHaveBeenLastCalledWith({
      message: "Custom save error",
      type: "error",
    });
  });
});
