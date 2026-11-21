import { Check, CircleDot, FileText, Play, ShieldCheck } from "lucide-react";
import { useCafeProjectDeliveryStatus } from "@/features/chapter1/cafeCoding/cafeDeliveryStatus";
import { useCafeSubmission } from "@/features/chapter1/cafeCoding/cafeSubmissionStore";
import { useWindows } from "@/core/windows/windowStore";
import { syncCafeWelcomeEmail } from "@/features/mail/mailIntegration";
import { CAFE_CALCULATOR_JOB_ID, CAFE_CALCULATOR_JOB_SLUG, findGigboardJobBySlug } from "../data/gigboardJobs";
import type { GigboardJob } from "../data/gigboardJobs";
import type { CafeWorkflow } from "@/features/chapter1/cafeCoding/cafeWorkflow";
import { CafeProjectSubmission } from "./CafeProjectSubmission";
import { CafeProjectPayment } from "./CafeProjectPayment";

export interface CafeGigBoardDeliveryProps {
  /** Optional test seam; production renders the canonical café listing. */
  readonly job?: GigboardJob;
  readonly workflow?: CafeWorkflow;
  readonly onOpenMail?: () => void;
}

/**
 * Delivery readiness and submission for the accepted café job in GigBoard.
 *
 * Readiness is derived from verified saved-file signatures; the submission and
 * review states come from their own persisted record. No payment is made here.
 */
export function CafeGigBoardDelivery({
  job,
  workflow = "development",
  onOpenMail,
}: CafeGigBoardDeliveryProps = {}) {
  const delivery = useCafeProjectDeliveryStatus();
  const submission = useCafeSubmission((state) => state.submission);

  const listing: Pick<GigboardJob, "id" | "title" | "client"> =
    job ??
    findGigboardJobBySlug(CAFE_CALCULATOR_JOB_SLUG) ?? {
      id: CAFE_CALCULATOR_JOB_ID,
      title: "Café Order Calculator",
      client: "Alex Morgan",
    };

  const documentationText = delivery.documentationVerified
    ? "Complete"
    : delivery.readmeChangedSinceVerification
      ? "Needs re-verification"
      : delivery.readmePresent
        ? "In progress"
        : "Not started";

  const finalChecksText = delivery.finalCheckPassed
    ? "Passed"
    : delivery.projectChangedSinceFinalCheck
      ? "Needs re-check"
      : "Not run";

  const openMail =
    onOpenMail ??
    (() => {
      void syncCafeWelcomeEmail();
      useWindows.getState().open("mail");
    });

  return (
    <section className="cq-gb-delivery" aria-labelledby="cq-gb-delivery-title">
      <div className="cq-gb-delivery-head">
        <div>
          <span>Development readiness</span>
          <h2 id="cq-gb-delivery-title">Project Delivery Preparation</h2>
        </div>
        <strong
          className={`cq-gb-delivery-status cq-gb-delivery-status-${delivery.status}`}
          data-testid="gigboard-delivery-status"
        >
          {delivery.loading ? "Checking…" : delivery.label}
        </strong>
      </div>

      <div className="cq-gb-delivery-grid">
        <div>
          {delivery.codingTasksComplete ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <CircleDot size={14} aria-hidden="true" />
          )}
          <span>Coding</span>
          <strong>
            {delivery.codingCompletedCount}/{delivery.codingTotal}
          </strong>
        </div>
        <div>
          <FileText size={14} aria-hidden="true" />
          <span>Documentation</span>
          <strong>{documentationText}</strong>
        </div>
        <div>
          <Play size={14} aria-hidden="true" />
          <span>Final checks</span>
          <strong>{finalChecksText}</strong>
        </div>
      </div>

      <p>
        <ShieldCheck size={14} aria-hidden="true" />
        {delivery.status === "ready-for-delivery"
          ? submission === null
            ? "Coding, documentation, and final tests are verified. No work has been submitted and no payment has been made."
            : "Coding, documentation, and final tests are verified. Your submission is tracked below; no payment has been made."
          : "This status comes from your saved project files. Continue the coding tasks, README documentation, and final checks in Tickets."}
      </p>

      {workflow === "development" ? (
        <>
          <CafeProjectSubmission
            projectName={listing.title}
            clientName={listing.client}
            jobId={listing.id}
            workflow={workflow}
            delivery={delivery}
            onOpenMail={openMail}
          />
          <CafeProjectPayment
            projectName={listing.title}
            clientName={listing.client}
            jobId={listing.id}
            workflow={workflow}
          />
        </>
      ) : null}
    </section>
  );
}
