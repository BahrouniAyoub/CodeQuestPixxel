import { useCallback, useEffect, useRef, useState } from "react";
import { getEntry } from "@/services/filesystem/filesystem";
import { useFileSession } from "@/features/editor/fileSession";
import { useCafeSetup } from "../cafeSetup/cafeSetupStore";
import { isCafeSetupComplete } from "../cafeSetup/cafeSetupProgress";
import { useCafeDev } from "./cafeDevStore";
import { CAFE_DEV_TASK_COUNT } from "./cafeDevTasks";
import { useCafeDoc } from "./cafeDocStore";
import {
  EMPTY_CAFE_PROJECT_SNAPSHOT,
  cafeDeliveryStatusLabel,
  evaluateCafeDeliveryStatus,
  readCafeProjectSnapshot,
  type CafeDeliveryStatus,
  type CafeProjectSnapshot,
} from "./cafeDelivery";

export interface CafeProjectDeliveryView {
  readonly status: CafeDeliveryStatus;
  readonly label: string;
  readonly loading: boolean;
  readonly codingTasksComplete: boolean;
  readonly codingCompletedCount: number;
  readonly codingTotal: number;
  readonly setupComplete: boolean;
  readonly documentationVerified: boolean;
  readonly readmeChangedSinceVerification: boolean;
  readonly finalCheckPassed: boolean;
  readonly projectChangedSinceFinalCheck: boolean;
  readonly missingFiles: readonly string[];
  readonly readmePresent: boolean;
  readonly snapshot: CafeProjectSnapshot;
  readonly refresh: () => Promise<void>;
}

/**
 * Shared delivery-status derivation used by Tickets and GigBoard. Both surfaces
 * read the same persisted records and the same saved-file signatures, so they
 * cannot disagree about readiness.
 */
export function useCafeProjectDeliveryStatus(): CafeProjectDeliveryView {
  const progress = useCafeDev((state) => state.progress);
  const developmentHydrated = useCafeDev((state) => state.hydrated);
  const hasSavedDevelopmentRecord = useCafeDev((state) => state.hasSavedRecord);
  const setupProgress = useCafeSetup((state) => state.progress);
  const setupHydrated = useCafeSetup((state) => state.hydrated);
  const docProgress = useCafeDoc((state) => state.progress);
  const docHydrated = useCafeDoc((state) => state.hydrated);

  const openFilePath = useFileSession((state) => state.filePath);
  const openFileDirty = useFileSession((state) => state.dirty);

  const [snapshot, setSnapshot] = useState<CafeProjectSnapshot | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await readCafeProjectSnapshot({ getEntry });
      if (mounted.current) setSnapshot(next);
    } catch {
      if (mounted.current) setSnapshot(EMPTY_CAFE_PROJECT_SNAPSHOT);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    void useCafeDev.getState().hydrate();
    void useCafeSetup.getState().hydrate();
    void useCafeDoc.getState().hydrate();
  }, []);

  useEffect(() => {
    // Re-read the saved files when the Editor opens or saves a file, and after
    // documentation/delivery records change.
    void refresh();
  }, [
    refresh,
    openFilePath,
    openFileDirty,
    docProgress,
    progress.currentTaskIndex,
    setupProgress.currentTaskIndex,
    hasSavedDevelopmentRecord,
  ]);

  const current = snapshot ?? EMPTY_CAFE_PROJECT_SNAPSHOT;
  const setupComplete = isCafeSetupComplete(setupProgress) || hasSavedDevelopmentRecord;
  const codingTasksComplete = progress.currentTaskIndex === CAFE_DEV_TASK_COUNT;
  const codingCompletedCount = progress.completedTasks.length;

  const documentationVerified =
    docProgress.documentation.verifiedAt !== null &&
    docProgress.documentation.readmeSignature !== null &&
    docProgress.documentation.readmeSignature === current.readmeSignature;
  const readmeChangedSinceVerification =
    docProgress.documentation.verifiedAt !== null &&
    docProgress.documentation.readmeSignature !== current.readmeSignature;

  const finalCheckPassed =
    docProgress.delivery.finalCheckPassed &&
    docProgress.delivery.projectSignature !== null &&
    docProgress.delivery.projectSignature === current.projectSignature;
  const projectChangedSinceFinalCheck =
    docProgress.delivery.finalCheckPassed &&
    docProgress.delivery.projectSignature !== current.projectSignature;

  const status = evaluateCafeDeliveryStatus({
    developmentComplete: codingTasksComplete,
    setupComplete,
    documentationVerified,
    finalCheckPassed,
  });

  return {
    status,
    label: cafeDeliveryStatusLabel(status),
    loading: !developmentHydrated || !setupHydrated || !docHydrated || snapshot === null,
    codingTasksComplete,
    codingCompletedCount,
    codingTotal: CAFE_DEV_TASK_COUNT,
    setupComplete,
    documentationVerified,
    readmeChangedSinceVerification,
    finalCheckPassed,
    projectChangedSinceFinalCheck,
    missingFiles: current.missingFiles,
    readmePresent: current.readme !== null,
    snapshot: current,
    refresh,
  };
}
