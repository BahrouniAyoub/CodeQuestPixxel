/**
 * Deterministic café workflow selection.
 *
 * A session is either the legacy three-milestone workflow or the four-task
 * development project, never a mixture.
 *
 * Legacy evidence always wins so old saves keep their established behaviour:
 * existing milestone progress, an already-created milestone file, or a completed
 * CH1-05 without a development record.
 *
 * Every other save is treated as development. A brand-new save has no legacy
 * evidence at all, so it must start the setup phase and the four-task project.
 * Older saves that are still at zero café progress lose nothing by continuing on
 * the current workflow. Defaulting an empty save to legacy is what showed new
 * players the retired three-milestone board in Tickets and GigBoard.
 */
import { CAFE_MILESTONE_COUNT } from "./cafeMilestones";
import { CAFE_DEV_TASK_COUNT } from "./cafeDevTasks";

export type CafeWorkflow = "legacy" | "development";

export interface CafeWorkflowSelectionInput {
  /** Legacy milestone progress index (0 when the record is absent). */
  readonly legacyMilestoneIndex: number;
  /** True when /Projects/Python/cafe_milestone_1.py already exists. */
  readonly legacyMilestoneFileExists: boolean;
  /** True when CH1-05 is already complete in a save without a dev record. */
  readonly ch1_05Completed: boolean;
  /** True when a valid four-task development record was loaded. */
  readonly developmentRecordPresent: boolean;
}

export function selectCafeWorkflow(input: CafeWorkflowSelectionInput): CafeWorkflow {
  // Existing legacy progress and milestone files always keep the old workflow.
  if (input.legacyMilestoneIndex > 0 || input.legacyMilestoneFileExists) {
    return "legacy";
  }

  // A saved development record is definitive, including after 4/4 when CH1-05
  // has already completed.
  if (input.developmentRecordPresent) return "development";

  // CH1-05 without a development record can only come from a legacy 3/3 save.
  if (input.ch1_05Completed) return "legacy";

  // No legacy evidence: a new save (or one that never started the milestones)
  // continues on the current setup + four-task development workflow.
  return "development";
}

export interface CafeWorkflowSummaryInput extends CafeWorkflowSelectionInput {
  readonly legacyCompleted: number;
  readonly developmentCompleted: number;
}

export interface CafeWorkflowSummary {
  readonly workflow: CafeWorkflow;
  readonly completed: number;
  readonly total: number;
}

/**
 * Return one workflow and its matching count. The two progress sources are
 * never combined, so the Tickets header cannot show "3/4" or "4/3".
 */
export function getCafeWorkflowSummary(input: CafeWorkflowSummaryInput): CafeWorkflowSummary {
  const workflow = selectCafeWorkflow(input);
  return workflow === "legacy"
    ? {
        workflow,
        completed: input.legacyCompleted,
        total: CAFE_MILESTONE_COUNT,
      }
    : {
        workflow,
        completed: input.developmentCompleted,
        total: CAFE_DEV_TASK_COUNT,
      };
}
