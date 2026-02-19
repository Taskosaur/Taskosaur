export const APP_GUIDE = `
## Routes
/settings → Org list | /settings/{org} → Org detail (tabs: Settings, Workflows, Members)
/{ws} → Workspace | /{ws}/settings | /{ws}/members
/{ws}/tasks/new → Task creation page (workspace pre-filled, select project from dropdown)
/{ws}/{proj} → Project | /{ws}/{proj}/settings | /{ws}/{proj}/members | /{ws}/{proj}/tasks

## Key Actions
- Create Sprint: Project → Sprints tab → Create Sprint → fill name/dates → Save
- Create Task: From /{ws}/tasks/new page → fill title → select project (data-automation-id="task-project-select") → click Create Task (data-automation-id="create-task-submit"). WARNING: The Create button on a workspace page (/{ws}) creates a PROJECT, NOT a task.
- Create Project: Workspace page (/{ws})/project or /project → New Project → fill name → Create
- Org Settings: /settings → click org card → edit → Save
- Workspace Settings: /{ws}/settings → edit → Save
- Project Settings: /{ws}/{proj}/settings → edit → Save
- Profile: /settings/profile → edit → Save

## UI Tips
- Tabs: click to switch views
- Modals: look for Save/Create/Confirm buttons
- Dropdowns: click to open, click option
- Actions: look for ⋮ menu

## Widget Rearrangement (Workspace Dashboard)
- Each widget on the workspace dashboard has move-up and move-down buttons (visible on hover).
- To move a widget: click the button with data-automation-id="widget-move-up-{widget-id}" or "widget-move-down-{widget-id}".
- Widget IDs: kpi-metrics, project-status, task-priority, task-type, sprint-status, monthly-completion.
- Example: To move "Task Priority" above "Project Status", click the move-up button for task-priority.
- To show/hide widgets, use the Dashboard Settings button (data-automation-id="dashboard-settings-button").

## CRITICAL: Invite Button Disambiguation
The header has a button with data-automation-id="header-pending-invitations" - this is ONLY for viewing invitations sent TO YOU (accept/decline). NEVER click this to invite new members.

To INVITE NEW MEMBERS, you must FIRST NAVIGATE to the correct members page:
- Invite to Workspace: Go to /{workspace}/members → click Invite button in content area
- Invite to Project: Go to /{workspace}/{project}/members → click Invite button in content area
- Invite to Organization: Go to /settings/{org} → click Members TAB (look for aria-label="Organization Members Tab" or data-automation-id="org-members-tab") → click Invite button in content area

RULE: If user says "invite [someone] to [workspace/project/org]", FIRST navigate to that entity's members page, THEN click the invite button in the main content (NOT header).

## CRITICAL: Settings Button Disambiguation
There are MULTIPLE settings buttons. Use the correct one based on context:

SIDEBAR SETTINGS (for navigating to settings pages):
- ORGANIZATION SETTINGS (data-automation-id="sidebar-org-settings", aria-label="All Settings"): Goes to /settings - list of all organizations
- WORKSPACE SETTINGS (data-automation-id="sidebar-workspace-settings", aria-label="Workspace Settings"): Goes to /{workspace}/settings - settings for current workspace
- PROJECT SETTINGS (data-automation-id="sidebar-project-settings", aria-label="Settings"): Goes to /{workspace}/{project}/settings - settings for current project

DASHBOARD SETTINGS (for customizing dashboard widgets and charts - IN PAGE CONTENT, NOT SIDEBAR):
- DASHBOARD SETTINGS BUTTON (data-automation-id="dashboard-settings-button", aria-label="Dashboard Settings"): Opens dropdown to customize dashboard widgets/metrics. This is inside workspace/project pages, NOT in sidebar.

RULE: Match the settings type to what the user asks for:
- "organization settings" or "org settings" → use sidebar-org-settings
- "workspace settings" → use sidebar-workspace-settings
- "project settings" → use sidebar-project-settings
- "dashboard settings" or "customize dashboard" → use dashboard-settings-button (in page content)
- If user just says "settings" without context, use the one matching current page level (sidebar settings, not dashboard)
`;

const workflows: Record<string, string> = {
  'create-sprint': `Sprint: Project → Sprints tab → Create Sprint → name, dates → Save`,
  'add-task-to-sprint': `Add to Sprint: Tasks tab → task → Add to Sprint OR drag to sprint`,
  'activate-sprint': `Activate: Sprints tab → find sprint → Start/Activate button`,
  'create-task': `Task: ONLY create tasks from /tasks page, /{ws}/tasks page, /{ws}/tasks/new page, or /{ws}/{proj}/tasks page. NEVER use the Create/New Project button on a workspace page — that creates a PROJECT, not a task.
If the user has NOT specified which workspace AND project, ASK them BEFORE taking any action.
If the user HAS specified the workspace and project, you MUST select EXACTLY that workspace and project — do NOT pick randomly.

ON THE /{ws}/tasks PAGE or /{ws}/{proj}/tasks PAGE:
- Use the "Add Task" inline row at the top of the task table — do NOT open the Create Task modal.
- Click the "Add Task" row to expand it, type the title, select project if on workspace-level, then press Enter or click the check button.
- If user specified a project, select it from the Project dropdown in the inline row.

ON THE /{ws}/tasks/new PAGE:
- The workspace is already pre-filled (read-only).
- Select the correct project from the dropdown (data-automation-id="task-project-select").
- After filling title and selecting project, click "Create Task" (data-automation-id="create-task-submit").
- Do NOT skip project selection. Do NOT select a random project.`,
  'create-project': `Project: Workspace → New Project → name → Create`,
  'organization-settings': `Org Settings: /settings → click org → edit → Save`,
  'workspace-settings': `Workspace Settings: /{ws}/settings → edit → Save`,
  'project-settings': `Project Settings: /{ws}/{proj}/settings → edit → Save`,
  'user-profile': `Profile: /settings/profile → edit → Save`,
  'invite-workspace': `Invite to Workspace: Navigate to /{workspace}/members → click Invite button (in content, NOT header) → fill email → Send`,
  'invite-project': `Invite to Project: Navigate to /{workspace}/{project}/members → click Invite button (in content, NOT header) → fill email → Send`,
  'invite-org': `Invite to Org: Navigate to /settings/{org} → click Members TAB (aria-label="Organization Members Tab") → click Invite button (in content, NOT header) → fill email → Send`,
};

export function getWorkflowGuide(taskType: string): string {
  return workflows[taskType] || '';
}

export function getCurrentPageContext(url: string): string {
  if (url.match(/\/settings\/[^/]+$/)) return `Org settings page: ${url.split('/settings/')[1]}`;
  if (url.includes('/settings/profile')) return 'Profile settings';
  if (url.includes('/settings')) return 'Org list page - click org card to manage';
  if (url.match(/\/([^/]+)\/([^/]+)\/settings/)) return 'Project settings page';
  // Check tasks/new BEFORE the broad /tasks pattern
  if (url.match(/\/([^/]+)\/([^/]+)\/tasks\/new/))
    return 'Task creation page (/{ws}/{proj}/tasks/new)';
  if (url.match(/\/([^/]+)\/tasks\/new/)) return 'Task creation page (/{ws}/tasks/new)';
  if (url.match(/\/([^/]+)\/([^/]+)\/tasks/)) return 'Project tasks page';
  if (url.match(/\/([^/]+)\/([^/]+)\/members/)) return 'Project members page';
  if (url.match(/\/([^/]+)\/settings$/)) return 'Workspace settings page';
  if (url.match(/\/([^/]+)\/members$/)) return 'Workspace members page';
  if (url.match(/\/([^/]+)\/tasks$/) || url.match(/\/([^/]+)\/tasks\?/))
    return 'Workspace tasks page';
  if (url.includes('/dashboard')) return 'Dashboard';
  if (url.match(/^https?:\/\/[^/]+\/tasks/) || url === '/tasks') return 'Global tasks page';
  if (url.includes('/tasks')) return 'Global tasks page';
  if (url.includes('/calendar')) return 'Calendar page';

  const parts = url
    .replace(/^https?:\/\/[^/]+/, '')
    .split('/')
    .filter(Boolean);
  if (parts.length === 2) return `Project: /${parts[0]}/${parts[1]}`;
  if (parts.length === 1) return `Workspace: /${parts[0]}`;
  return 'Unknown page';
}

export function enhancePromptWithContext(userRequest: string, currentUrl: string): string {
  const ctx = getCurrentPageContext(currentUrl);
  const req = userRequest.toLowerCase();
  let hint = '';

  if (req.includes('sprint')) {
    if (req.includes('create')) hint = getWorkflowGuide('create-sprint');
    else if (req.includes('activate') || req.includes('start'))
      hint = getWorkflowGuide('activate-sprint');
    else if (req.includes('add')) hint = getWorkflowGuide('add-task-to-sprint');
  } else if (req.includes('task') && req.includes('create')) {
    hint = getWorkflowGuide('create-task');
    if (ctx.includes('Task creation page')) {
      const isProjectTaskNew = ctx.includes('{proj}');
      if (isProjectTaskNew) {
        hint += `\nYou are on the TASK CREATION page (/{ws}/{proj}/tasks/new). if the project is already selected.\nSteps:\n1. Type the task title in the title input field\n2. You MUST scroll down and then click the "Create Task" button (data-automation-id="create-task-submit") to submit. This is NOT auto-saved — you MUST click the button.\nDo NOT skip clicking the Create Task button.`;
      } else {
        hint += `\nYou are on the TASK CREATION page (/{ws}/tasks/new).\nSteps:\n1. Type the task title in the title input field\n2. Select the CORRECT project using the project dropdown (data-automation-id="task-project-select")\n3. You MUST click the "Create Task" button (data-automation-id="create-task-submit") to submit. This is NOT auto-saved — you MUST click the button.\nDo NOT skip any step. Do NOT skip clicking Create Task. Do NOT select a random project.`;
      }
    } else if (ctx === 'Workspace tasks page') {
      hint += `\nYou are on the WORKSPACE TASKS page. Use the "Add Task" inline row at the top of the task table — do NOT open the Create Task modal.\nSteps:\n1. Click the "Add Task" button/row at the top of the table to expand the inline form\n2. Type the task title in the inline title input field\n3. Select the project from the Project dropdown — use the project the user specified in this conversation. If they NEVER mentioned a project at all, ask ONCE only.\n4. WAIT a moment after selecting the project — the Status will auto-fill. Verify status shows a value.\n5. Press Enter or click the check (✓) button to create the task\nIMPORTANT: Status auto-fills AFTER project selection. If status is empty, task creation will FAIL.\nCRITICAL: If the user already told you the project name in a previous message, USE IT. Do NOT ask again.`;
    } else if (ctx === 'Project tasks page') {
      hint += `\nYou are on the PROJECT TASKS page. Use the "Add Task" inline row at the top of the task table — do NOT open the Create Task modal.\nSteps:\n1. Click the "Add Task" button/row at the top of the table to expand the inline form\n2. Type the task title in the inline title input field\n3. The project and status are already set — do NOT change them.\n4. Press Enter or click the check (✓) button to create the task`;
    } else if (ctx === 'Global tasks page') {
      hint += `\nYou are on the GLOBAL TASKS page. The Create Task modal uses SEARCHABLE combobox dropdowns for workspace and project. Steps:\n1. Click "Create Task" button to open the modal\n2. Type the task title\n3. Click the workspace dropdown (data-automation-id="select-workspace"), then TYPE the workspace name in the search input (data-automation-id="search-workspace-input") to filter, then click the correct match\n4. Click the project dropdown (data-automation-id="select-project"), then TYPE the project name in the search input (data-automation-id="search-project-input") to filter, then click the correct match\n5. Click "Create Task" button (data-automation-id="create-task-submit") to submit\nCRITICAL: You MUST type in the search inputs to find the correct workspace/project. Do NOT just click the first item.`;
    } else if (ctx.startsWith('Workspace:') || ctx === 'Dashboard' || ctx === 'Unknown page') {
      hint += `\nWARNING: You are currently on "${ctx}" which is NOT a task creation page. The Create/New button here creates a PROJECT, not a task. You MUST ASK the user which project to use, then navigate to that project's tasks page before creating a task. Do NOT click any Create button on this page.`;
    }
  } else if (req.includes('project') && req.includes('create')) {
    hint = getWorkflowGuide('create-project');
  } else if (req.includes('setting')) {
    if (req.includes('profile')) {
      hint = getWorkflowGuide('user-profile');
    } else if (req.includes('dashboard')) {
      hint = `SETTINGS DISAMBIGUATION: Use the DASHBOARD SETTINGS button (data-automation-id="dashboard-settings-button", aria-label="Dashboard Settings") in the page content area (NOT sidebar). This customizes dashboard widgets/metrics.`;
    } else if (req.includes('org')) {
      hint = `SETTINGS DISAMBIGUATION: Use sidebar button with data-automation-id="sidebar-org-settings" (aria-label="All Settings") to go to organization settings.\n${getWorkflowGuide('organization-settings')}`;
    } else if (req.includes('workspace')) {
      hint = `SETTINGS DISAMBIGUATION: Use sidebar button with data-automation-id="sidebar-workspace-settings" (aria-label="Workspace Settings").\n${getWorkflowGuide('workspace-settings')}`;
    } else if (req.includes('project')) {
      hint = `SETTINGS DISAMBIGUATION: Use sidebar button with data-automation-id="sidebar-project-settings" (aria-label="Settings").\n${getWorkflowGuide('project-settings')}`;
    } else {
      hint = `SETTINGS DISAMBIGUATION: There are multiple settings buttons. Choose based on what you need:
- Organization settings: data-automation-id="sidebar-org-settings" (in sidebar)
- Workspace settings: data-automation-id="sidebar-workspace-settings" (in sidebar)
- Project settings: data-automation-id="sidebar-project-settings" (in sidebar)
- Dashboard settings: data-automation-id="dashboard-settings-button" (in page content, for customizing widgets)`;
    }
  } else if (req.includes('profile')) {
    hint = getWorkflowGuide('user-profile');
  } else if (
    req.includes('widget') ||
    (req.includes('move') &&
      (req.includes('left') ||
        req.includes('right') ||
        req.includes('up') ||
        req.includes('down') ||
        req.includes('first') ||
        req.includes('top') ||
        req.includes('bottom')))
  ) {
    hint = `WIDGET REARRANGEMENT: Each dashboard widget has move-up (data-automation-id="widget-move-up-{id}") and move-down (data-automation-id="widget-move-down-{id}") buttons. Click these to reorder widgets. Widget IDs: kpi-metrics, project-status, task-priority, task-type, sprint-status, monthly-completion. "Move left/up" = move-up button, "move right/down" = move-down button. Click multiple times to move several positions.`;
  } else if (req.includes('invite')) {
    const baseWarning = `CRITICAL: Do NOT click the header button (data-automation-id="header-pending-invitations") - that is for viewing YOUR incoming invitations, not for inviting others.`;
    if (req.includes('workspace')) {
      hint = `${baseWarning}\n${getWorkflowGuide('invite-workspace')}`;
    } else if (req.includes('project')) {
      hint = `${baseWarning}\n${getWorkflowGuide('invite-project')}`;
    } else if (req.includes('org')) {
      hint = `${baseWarning}\n${getWorkflowGuide('invite-org')}`;
    } else {
      hint = `${baseWarning}\nTo invite someone: first navigate to the workspace/project/org members page, then click the Invite button in the main content area.`;
    }
  } else if (
    (req.includes('filter') ||
      req.includes('show') ||
      req.includes('display') ||
      req.includes('get')) &&
    (req.includes('priority') ||
      req.includes('status') ||
      req.includes('type') ||
      req.includes('assignee') ||
      req.includes('reporter'))
  ) {
    hint = `FILTER BEHAVIOR: The filter dropdown uses checkboxes that TOGGLE. When the user says "filter by [value]", ensure ONLY that value ends up checked. First UNCHECK any other checked items in the same filter section, then CHECK the target value if not already checked. Look at data-state="checked" vs data-state="unchecked" on checkboxes to determine current state.`;
  }

  return `Context: ${ctx} | URL: ${currentUrl}${hint ? `\nHint: ${hint}` : ''}\n${APP_GUIDE}`;
}
