import { AutomationResult, navigateTo, waitFor, waitForElement } from "./helpers";

export async function inviteMember(
  workspaceSlug: string,
  projectSlug: string,
  email: string,
  role: string,
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 10000 } = options;

  try {
    // Navigate to members page
    const membersUrl = `/${workspaceSlug}/${projectSlug}/members`;
    await navigateTo(membersUrl);
    await waitForElement(".dashboard-container", timeout);
    await waitFor(500);

    const _user = localStorage.getItem("user");
    const user = JSON.parse(_user);

    if (user.role !== "MANAGER" && user.role !== "SUPER_ADMIN") {
      return {
        success: false,
        message: "The logged-in user does not have the privilege to invite members.",
        data: { email, role, workspaceSlug, projectSlug },
      };
    }

    // Open Invite Member modal
    const inviteBtnWrapper = document.querySelector(
      '[data-automation-id="invite-member-btn"]'
    ) as HTMLElement | null;
    if (!inviteBtnWrapper) throw new Error("Invite Member button wrapper not found");

    const inviteBtn = inviteBtnWrapper.querySelector("button") as HTMLButtonElement | null;
    if (!inviteBtn) throw new Error("Invite Member button not found");
    inviteBtn.click();

    // Wait for modal
    await waitForElement('[automation-id="invite-modal"]', timeout);

    const modal = document.querySelector('[automation-id="invite-modal"]') as HTMLElement | null;
    if (!modal) throw new Error("Invite Modal not found");

    const emailInput = (await waitForElement("#invite-email", timeout)) as HTMLInputElement | null;
    if (!emailInput) throw new Error("Email input not found");

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;

    nativeInputValueSetter?.call(emailInput, email);

    emailInput.dispatchEvent(new Event("input", { bubbles: true }));

    // Role select trigger
    const roleTrigger = (await waitForElement('[role="combobox"]', timeout)) as HTMLElement | null;
    if (!roleTrigger) throw new Error("Role dropdown trigger not found");
    roleTrigger.click();

    await waitFor(300);
    const roleOption = Array.from(document.querySelectorAll('[role="option"]')).find((el) =>
      el.textContent?.toLowerCase().includes(role.toLowerCase())
    ) as HTMLElement | null;

    if (!roleOption) throw new Error(`Role option "${role}" not found`);
    roleOption.click();

    // Send Invite
    const sendBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (!sendBtn) throw new Error("Send Invite button not found");
    sendBtn.click();

    await waitFor(2000);

    return {
      success: true,
      message: `Invited ${email} as ${role} to ${workspaceSlug}/${projectSlug}`,
      data: { email, role, workspaceSlug, projectSlug },
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to invite member",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
