/**
 * Lightweight module-level memory for the Tickets app.
 *
 * The OS window manager can unmount and remount apps when the player switches
 * windows. Keeping the selected project and café task here means returning to
 * Tickets resumes where the player left off without adding another persisted
 * database record.
 */
import {
  CAFE_MILESTONE_IDS,
  isCafeMilestoneId,
  type CafeMilestoneId,
} from "@/features/chapter1/cafeCoding/cafeMilestones";
import {
  CAFE_DEV_TASK_IDS,
  isCafeDevTaskId,
  type CafeDevTaskId,
} from "@/features/chapter1/cafeCoding/cafeDevTasks";

export type TicketsView = "general" | "cafe";

const DEFAULT_CAFE_TASK_ID: CafeMilestoneId = CAFE_MILESTONE_IDS[0];
const DEFAULT_CAFE_DEV_TASK_ID: CafeDevTaskId = CAFE_DEV_TASK_IDS[0];

let view: TicketsView = "general";
let selectedCafeTaskId: CafeMilestoneId = DEFAULT_CAFE_TASK_ID;
let selectedCafeDevTaskId: CafeDevTaskId = DEFAULT_CAFE_DEV_TASK_ID;

export function getTicketsView(): TicketsView {
  return view;
}

export function setTicketsView(next: TicketsView): void {
  view = next;
}

export function getSelectedCafeTaskId(): CafeMilestoneId {
  return selectedCafeTaskId;
}

export function setSelectedCafeTaskId(id: CafeMilestoneId): void {
  if (!isCafeMilestoneId(id)) return;
  selectedCafeTaskId = id;
}

export function getSelectedCafeDevTaskId(): CafeDevTaskId {
  return selectedCafeDevTaskId;
}

export function setSelectedCafeDevTaskId(id: CafeDevTaskId): void {
  if (!isCafeDevTaskId(id)) return;
  selectedCafeDevTaskId = id;
}

/** Test-only reset so module state cannot leak between test cases. */
export function resetTicketsViewStateForTests(): void {
  view = "general";
  selectedCafeTaskId = DEFAULT_CAFE_TASK_ID;
  selectedCafeDevTaskId = DEFAULT_CAFE_DEV_TASK_ID;
}
