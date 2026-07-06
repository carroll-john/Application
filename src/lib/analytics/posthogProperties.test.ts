import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  initialApplicationData,
  type ApplicationData,
  type ApplicationMeta,
} from "../applicationData";

const capturePostHogEventMock = vi.hoisted(() => vi.fn());
const canCapturePostHogMock = vi.hoisted(() => vi.fn(() => true));
const initPostHogMock = vi.hoisted(() => vi.fn());

vi.mock("./posthogClient", () => ({
  canCapturePostHog: canCapturePostHogMock,
  capturePostHogEvent: capturePostHogEventMock,
  initPostHog: initPostHogMock,
}));

async function importPostHogProperties() {
  vi.resetModules();
  return import("./posthogProperties");
}

function makeApplication(
  applicationMeta: Partial<ApplicationMeta> = {},
): ApplicationData {
  return {
    ...initialApplicationData,
    applicationMeta: {
      recordId: "application-123",
      applicationNumber: "APP-123",
      applicantProfileId: "profile-123",
      selectedCourse: {
        code: "mba-online",
        intake: "2026-S1",
        provider: "Example University",
        title: "Master of Business Administration",
      },
      status: "draft",
      ...applicationMeta,
    },
  };
}

describe("trackPostHogPageView", () => {
  beforeEach(() => {
    capturePostHogEventMock.mockClear();
    canCapturePostHogMock.mockReturnValue(true);
    initPostHogMock.mockClear();
  });

  it("waits for hydrated application context on application routes", async () => {
    const { trackPostHogPageView } = await importPostHogProperties();
    const application = makeApplication();

    trackPostHogPageView("/overview", "", {
      application,
      isHydrating: true,
    });
    trackPostHogPageView("/overview", "", {
      application,
      isHydrating: false,
    });

    expect(capturePostHogEventMock).toHaveBeenCalledTimes(1);
    expect(capturePostHogEventMock).toHaveBeenCalledWith(
      "$pageview",
      expect.objectContaining({
        application_id: "application-123",
        course_code: "mba-online",
        page_group: "application",
        page_key: "application_overview",
      }),
    );
  });

  it("does not send incomplete application pageviews", async () => {
    const { trackPostHogPageView } = await importPostHogProperties();

    trackPostHogPageView("/overview", "", {
      application: initialApplicationData,
      isHydrating: false,
    });

    expect(capturePostHogEventMock).not.toHaveBeenCalled();
    expect(initPostHogMock).not.toHaveBeenCalled();
  });

  it("keeps public catalog pageviews independent from application context", async () => {
    const { trackPostHogPageView } = await importPostHogProperties();

    trackPostHogPageView("/", "", {
      application: initialApplicationData,
      isHydrating: true,
    });

    expect(capturePostHogEventMock).toHaveBeenCalledWith(
      "$pageview",
      expect.objectContaining({
        page_group: "catalog",
        page_key: "course_catalog",
      }),
    );
    const properties = capturePostHogEventMock.mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(properties.application_id).toBeUndefined();
    expect(properties.course_code).toBeUndefined();
  });
});

describe("trackApplicationStepView", () => {
  beforeEach(() => {
    capturePostHogEventMock.mockClear();
    canCapturePostHogMock.mockReturnValue(true);
    initPostHogMock.mockClear();
  });

  it("does not let a pre-hydration step view de-dupe the hydrated event", async () => {
    const { trackApplicationStepView } = await importPostHogProperties();
    const application = makeApplication();

    trackApplicationStepView("/section2/qualifications", initialApplicationData, {
      isHydrating: true,
    });
    trackApplicationStepView("/section2/qualifications", application, {
      isHydrating: false,
    });

    expect(capturePostHogEventMock).toHaveBeenCalledTimes(1);
    expect(capturePostHogEventMock).toHaveBeenCalledWith(
      "application_step_viewed",
      expect.objectContaining({
        application_id: "application-123",
        application_step_key: "section2_qualifications",
        course_code: "mba-online",
      }),
    );
  });

  it("de-dupes by application route context, not pathname alone", async () => {
    const { trackApplicationStepView } = await importPostHogProperties();

    trackApplicationStepView("/overview", makeApplication());
    trackApplicationStepView("/overview", makeApplication());
    trackApplicationStepView(
      "/overview",
      makeApplication({ recordId: "application-456" }),
    );

    expect(capturePostHogEventMock).toHaveBeenCalledTimes(2);
    expect(capturePostHogEventMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        application_id: "application-456",
        course_code: "mba-online",
      }),
    );
  });
});
