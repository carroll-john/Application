import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { initialApplicationData, type ApplicationData } from "../../../lib/applicationData";
import type { ApplicationStorageAdapter } from "../../../lib/applicationStorageAdapter";
import type { StoredApplicantProfile } from "../../../lib/applicantProfileStore";
import { createApplicationOperationScope } from "./applicationOperationScope";
import { hydrateApplicationState } from "./useApplicationHydration";
import { useApplicationPersistence } from "./useApplicationPersistence";
import { useApplicationLifecycle } from "./useApplicationLifecycle";
import { useApplicationData } from "./useApplicationData";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const application = (id: string): ApplicationData => ({
  ...initialApplicationData,
  applicationMeta: { ...initialApplicationData.applicationMeta, recordId: id },
});
const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";

// These hooks expose async commands. SSR obtains the actual callbacks without
// mocking React or a browser; delayed adapter responses drive the races below.
function getHook<T>(useHook: () => T): T {
  let value!: T;
  function Harness() { value = useHook(); return null; }
  renderToStaticMarkup(<Harness />);
  return value;
}

function persistenceHarness() {
  const pending = deferred<ApplicationData>();
  const scope = createApplicationOperationScope();
  let activeId = A;
  const setData = vi.fn();
  const setActiveApplicationId = vi.fn();
  const upsertSummary = vi.fn();
  const saveApplication = vi.fn(() => pending.promise);
  const actions = getHook(() => useApplicationPersistence({
    activeApplicationId: A,
    getActiveApplicationId: () => activeId,
    operationScope: scope,
    applicantProfileId: null,
    data: application(A),
    storageAdapter: { saveApplication } as unknown as ApplicationStorageAdapter,
    setData, setActiveApplicationId, upsertSummary,
  }));
  return {
    actions, scope, pending, setData, setActiveApplicationId, upsertSummary, saveApplication,
    openB() { scope.beginSelection(); activeId = B; },
  };
}

describe("application operation ownership", () => {
  it("lets A finish saving without replacing the newly opened B", async () => {
    const h = persistenceHarness();
    const save = h.actions.persistApplication(application(A));
    h.openB();
    h.pending.resolve(application(A));
    await save;
    expect(h.upsertSummary).toHaveBeenCalledWith(application(A));
    expect(h.setData).not.toHaveBeenCalled();
    expect(h.setActiveApplicationId).not.toHaveBeenCalled();
  });

  it("does not activate an old existing draft when its shell save starts after B opens", async () => {
    const h = persistenceHarness();
    h.openB();
    const save = h.actions.persistApplication(application(A), { forceCreate: true, shellOnly: true });
    h.pending.resolve(application(A));
    await save;
    expect(h.setData).not.toHaveBeenCalled();
  });

  it("publishes a save normally while its application remains selected", async () => {
    const h = persistenceHarness();
    const save = h.actions.persistApplication(application(A));
    h.pending.resolve(application(A));
    await save;
    expect(h.setData).toHaveBeenCalledWith(application(A));
    expect(h.setActiveApplicationId).toHaveBeenCalledWith(A);
  });

  it("ignores all publication from a save completed after sign-out", async () => {
    const h = persistenceHarness();
    const save = h.actions.persistApplication(application(A));
    h.scope.dispose();
    h.pending.resolve(application(A));
    await expect(save).rejects.toThrow("active account or application changed");
    expect(h.upsertSummary).not.toHaveBeenCalled();
    expect(h.setData).not.toHaveBeenCalled();
  });

  it("rejects queued writes before they reach storage after sign-out", async () => {
    const h = persistenceHarness();
    const actions = getHook(() => useApplicationData({
      data: application(A), operationScope: h.scope,
      persistApplication: h.actions.persistApplication,
      trackApplicationDataEvent: vi.fn(),
    }));
    const edit = actions.updatePersonalDetails({ firstName: "Alice" });
    h.scope.dispose();
    await expect(edit).rejects.toThrow("active account or application changed");
    expect(h.saveApplication).not.toHaveBeenCalled();
  });

  it("does not revive old callbacks when an effect is set up again", () => {
    const scope = createApplicationOperationScope();
    const old = scope.captureSession();
    scope.dispose();
    scope.activate();
    expect(old()).toBe(false);
    expect(scope.captureSession()()).toBe(true);
  });

  it("only publishes the most recently requested application", async () => {
    const scope = createApplicationOperationScope();
    const pendingA = deferred<ApplicationData>();
    const setData = vi.fn();
    const lifecycle = getHook(() => useApplicationLifecycle({
      activeApplicationId: null, operationScope: scope, getActiveApplicationId: () => null,
      setIsHydrating: vi.fn(),
      applications: [], data: initialApplicationData,
      setActiveApplicationId: vi.fn(), setApplicantProfile: vi.fn(),
      setApplications: vi.fn(), setData, trackApplicationSubmitted: vi.fn(), upsertSummary: vi.fn(),
      storageAdapter: {
        loadApplicationById: (id: string) => id === A ? pendingA.promise : Promise.resolve(application(B)),
      } as ApplicationStorageAdapter,
    }));
    const first = lifecycle.openApplication(A);
    await lifecycle.openApplication(B);
    pendingA.resolve(application(A));
    await first;
    expect(setData.mock.calls).toEqual([[application(B)]]);
  });
});

describe("hydration cancellation", () => {
  function hydrationHarness() {
    const scope = createApplicationOperationScope();
    const setData = vi.fn();
    const setActiveApplicationId = vi.fn();
    const setApplications = vi.fn();
    const hydrate = (storageAdapter: Partial<ApplicationStorageAdapter>, ensureApplicantProfile = async (): Promise<StoredApplicantProfile | null> => null) =>
      hydrateApplicationState({
        storageAdapter: storageAdapter as ApplicationStorageAdapter,
        ensureApplicantProfile, isCurrent: scope.beginSelection(),
        setData, setActiveApplicationId, setApplications,
      });
    return { scope, hydrate, setData, setActiveApplicationId, setApplications };
  }

  it.each([true, false])("ignores a late application response after sign-out (found=%s)", async (found) => {
    const h = hydrationHarness();
    const pending = deferred<ApplicationData | null>();
    const load = vi.fn(() => pending.promise);
    const old = h.hydrate({ listApplications: async () => [{ id: A, status: "draft" }] as never, loadApplicationById: load });
    await vi.waitFor(() => expect(load).toHaveBeenCalled());
    h.scope.dispose();
    h.setData.mockClear();
    h.setActiveApplicationId.mockClear();
    pending.resolve(found ? application(A) : null);
    await old;
    expect(h.setData).not.toHaveBeenCalled();
    expect(h.setActiveApplicationId).not.toHaveBeenCalled();
  });

  it("ignores a delayed list when newer signed-out hydration has cleared the data", async () => {
    const h = hydrationHarness();
    const pending = deferred<never[]>();
    const old = h.hydrate({ listApplications: () => pending.promise });
    await Promise.resolve();
    await h.hydrate({ listApplications: async () => [] });
    pending.resolve([{ id: A, status: "draft" }] as never[]);
    await old;
    expect(h.setApplications.mock.calls).toEqual([[[]]]);
    expect(h.setData.mock.calls).toEqual([[initialApplicationData]]);
  });

  it("does not start listing after an obsolete profile request finishes", async () => {
    const h = hydrationHarness();
    const profile = deferred<StoredApplicantProfile | null>();
    const listApplications = vi.fn(async () => []);
    const old = h.hydrate({ listApplications }, () => profile.promise);
    h.scope.dispose();
    profile.resolve(null);
    await old;
    expect(listApplications).not.toHaveBeenCalled();
  });
});
