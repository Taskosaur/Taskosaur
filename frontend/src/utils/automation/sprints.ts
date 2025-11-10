import {
  AutomationResult,
  navigateTo,
  waitFor,
  waitForElement,
  simulateClick,
  normalizeDate, // yyy-mm-dd
} from "./helpers";

function setReactInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(el.constructor.prototype, "value")?.set;
  nativeSetter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}

export async function createSprint(
  workspaceSlug: string,
  projectSlug: string,
  name: string,
  status: string,
  startDate: string,
  endDate: string,
  goalDescription?: string,
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 10000 } = options;

  try {
    // Navigate to sprints page
    const sprintsUrl = `/${workspaceSlug}/${projectSlug}/sprints`;
    await navigateTo(sprintsUrl);
    await waitForElement(".dashboard-container", timeout);

    // Open modal
    await waitFor(500);
    const sprintBtnWrapper = document.querySelector(
      '[automation-id="sprint-container"]'
    ) as HTMLElement | null;
    if (!sprintBtnWrapper) throw new Error("Create Sprint button wrapper not found");

    await waitFor(1000);
    const sprintBtn = sprintBtnWrapper.querySelector("button") as HTMLButtonElement | null;
    if (!sprintBtn) throw new Error("Create Sprint button not found");
    await simulateClick(sprintBtn);

    // Wait for modal
    await waitForElement('[automation-id="create-sprint-modal"]', timeout);

    // ---- Fill Sprint Name ----
    const nameInput = (await waitForElement("#name", timeout)) as HTMLInputElement | null;
    if (!nameInput) throw new Error("Sprint name input not found");
    setReactInputValue(nameInput, name);

    // ---- Fill Sprint Goal (optional) ----
    if (goalDescription) {
      const goalInput = (await waitForElement("#goal", timeout)) as HTMLTextAreaElement | null;
      if (goalInput) {
        setReactInputValue(goalInput, goalDescription);
      }
    }

    // ---- Select Status ----
    const statusTrigger = (await waitForElement(
      '[role="combobox"]',
      timeout
    )) as HTMLElement | null;
    if (!statusTrigger) throw new Error("Sprint status dropdown not found");
    await simulateClick(statusTrigger);

    await waitFor(300);
    const statusOption = Array.from(document.querySelectorAll('[role="option"]')).find((el) =>
      el.textContent?.toLowerCase().includes(status.toLowerCase())
    ) as HTMLElement | null;
    if (!statusOption) throw new Error(`Status option "${status}" not found`);
    await simulateClick(statusOption);

    // ---- Set Start Date ----
    const startDateInput = (await waitForElement("#startDate", timeout)) as HTMLInputElement | null;
    if (!startDateInput) throw new Error("Start date input not found");
    setReactInputValue(startDateInput, normalizeDate(startDate));
    await waitFor(500);

    // ---- Set End Date ----
    const endDateInput = (await waitForElement("#endDate", timeout)) as HTMLInputElement | null;
    if (!endDateInput) throw new Error("End date input not found");
    setReactInputValue(endDateInput, normalizeDate(endDate));
    await waitFor(500);

    // ---- Submit ----
    const createBtn = (await waitForElement('button[type="submit"]')) as HTMLButtonElement | null;
    if (!createBtn) throw new Error("Create Sprint submit button not found");

    // ensure validation has fired
    await waitFor(300);
    if (createBtn.disabled) {
      throw new Error("Create Sprint button is still disabled after filling all fields");
    }

    await simulateClick(createBtn);
    await waitFor(500);

    return {
      success: true,
      message: `Created sprint "${name}" with status ${status}`,
      data: { workspaceSlug, projectSlug, name, status, startDate, endDate, goalDescription },
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to create sprint",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
