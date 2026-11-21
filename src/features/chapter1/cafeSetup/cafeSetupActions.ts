import { useWindows } from "@/core/windows/windowStore";
import { useFileSession } from "@/features/editor/fileSession";
import { getEntry } from "@/services/filesystem/filesystem";
import { openCafeProjectInEditor } from "../cafeCoding/cafeProjectFiles";
import { useCafeMilestones } from "../cafeCoding/cafeMilestoneStore";
import { verifyCafeSetupTask, type CafeSetupVerificationOptions } from "./cafeSetupChecks";
import { detectLegacyCafeProject } from "./cafeSetupCompatibility";
import { isCafeSetupComplete } from "./cafeSetupProgress";
import { useCafeSetup } from "./cafeSetupStore";
import {
  CAFE_PROJECT_DIRECTORY,
  getCafeSetupTask,
  getCafeSetupTaskByIndex,
  type CafeSetupTaskId,
} from "./cafeSetupTasks";

export interface CafeSetupActionResult {
  readonly ok: boolean;
  readonly message: string;
}

const PLAN_PATH = `${CAFE_PROJECT_DIRECTORY}/PLAN.md`;

/** Open the app that matches the current setup task. Never creates files. */
export async function openCafeSetupApp(taskId: CafeSetupTaskId): Promise<CafeSetupActionResult> {
  const task = getCafeSetupTask(taskId);

  if (task.app === "explorer") {
    useWindows.getState().open("explorer");
    return {
      ok: true,
      message:
        taskId === "create-folder"
          ? "File Explorer opened. Navigate to /Projects/Python and create the cafe-calculator folder."
          : "File Explorer opened. Create or check the project files inside cafe-calculator.",
    };
  }

  if (task.app === "editor") {
    const entry = await getEntry(PLAN_PATH);
    if (!entry) {
      useWindows.getState().open("explorer");
      return {
        ok: false,
        message: "PLAN.md does not exist yet. Create it in File Explorer first.",
      };
    }
    if (entry.kind !== "file") {
      return { ok: false, message: "PLAN.md is a folder. Recreate it as a file." };
    }
    if (!useFileSession.getState().openFile(PLAN_PATH)) {
      return {
        ok: false,
        message: "Your current file has unsaved changes. Save or discard them, then try again.",
      };
    }
    useWindows.getState().open("editor");
    return { ok: true, message: "PLAN.md opened in the Editor." };
  }

  return {
    ok: false,
    message: "The client brief is shown in the accepted GigBoard project.",
  };
}

/**
 * Verify the current setup task against the real filesystem, then persist
 * completion through the setup store. A failed save is reported and nothing is
 * marked complete.
 */
export async function checkCafeSetupTask(
  taskId: CafeSetupTaskId,
  options: CafeSetupVerificationOptions = {},
  fileSystem?: Parameters<typeof verifyCafeSetupTask>[2],
): Promise<CafeSetupActionResult> {
  const verification = await verifyCafeSetupTask(taskId, options, fileSystem);
  if (!verification.ok) {
    return { ok: false, message: verification.reason };
  }

  const completion = await useCafeSetup.getState().completeTask(taskId);
  if (!completion.ok) {
    return { ok: false, message: completion.reason };
  }

  const next = getCurrentSetupTaskTitle();
  return {
    ok: true,
    message: next
      ? `Task complete. Next: ${next}.`
      : "Project setup complete. The four café development tasks are unlocked.",
  };
}

function getCurrentSetupTaskTitle(): string | null {
  const progress = useCafeSetup.getState().progress;
  const task = getCafeSetupTaskByIndex(progress.currentTaskIndex);
  return task?.title ?? null;
}

/**
 * GigBoard's project launch adapter. New sessions are sent to the current setup
 * app; completed or legacy sessions open the existing milestone workflow.
 */
export async function openCafeProjectWorkspace(): Promise<CafeSetupActionResult> {
  await useCafeSetup.getState().hydrate();
  await useCafeMilestones.getState().hydrate();

  const setup = useCafeSetup.getState();
  const setupComplete = isCafeSetupComplete(setup.progress);
  const legacy = setupComplete ? false : await detectLegacyCafeProject();

  if (setupComplete || legacy) {
    const result = await openCafeProjectInEditor();
    return {
      ok: result.ok,
      message: result.ok ? "Opened your current café project in the Editor." : result.reason,
    };
  }

  const task = getCafeSetupTaskByIndex(setup.progress.currentTaskIndex);
  if (!task) {
    return { ok: false, message: "The café project setup is complete. Open the Editor to code." };
  }
  if (task.id === "read-brief") {
    return {
      ok: false,
      message: "Read the client brief and mark it reviewed before the project workspace unlocks.",
    };
  }
  return openCafeSetupApp(task.id);
}
