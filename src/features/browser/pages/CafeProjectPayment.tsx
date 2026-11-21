import { useEffect, useState, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  Wallet,
} from "lucide-react";
import { getCurrentChapter1Quest } from "@/features/chapter1/chapter1Progress";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import {
  CAFE_PAYMENT_AMOUNT,
  evaluateCafePaymentEligibility,
} from "@/features/chapter1/cafeCoding/cafePayment";
import { useCafePayment } from "@/features/chapter1/cafeCoding/cafePaymentStore";
import {
  CAFE_PAYMENT_MESSAGE_ID,
  claimCafePayment,
  reconcileCafePaymentQuest,
  retryCafePaymentMail,
} from "@/features/chapter1/cafeCoding/cafePaymentService";
import { useCafeSubmission } from "@/features/chapter1/cafeCoding/cafeSubmissionStore";
import type { CafeWorkflow } from "@/features/chapter1/cafeCoding/cafeWorkflow";
import { useGigboardApplication } from "../gigboardApplicationStore";
import { useMail } from "@/features/mail/mailStore";

export interface CafeProjectPaymentProps {
  readonly projectName: string;
  readonly clientName: string;
  readonly jobId: string;
  readonly workflow: CafeWorkflow;
}

/**
 * Explicit $50 claim for an approved café submission. Eligibility is derived
 * from persisted records; the claim itself is handled by the idempotent payment
 * service so a reload, double-click, or retry can never credit twice.
 */
export function CafeProjectPayment({
  projectName,
  clientName,
  jobId,
  workflow,
}: CafeProjectPaymentProps) {
  const payment = useCafePayment((state) => state.payment);
  const paymentHydrated = useCafePayment((state) => state.hydrated);
  const paymentInvalid = useCafePayment((state) => state.invalidRecord);
  const paymentError = useCafePayment((state) => state.error);
  const submission = useCafeSubmission((state) => state.submission);
  const submissionHydrated = useCafeSubmission((state) => state.hydrated);
  const chapterProgress = useChapter1((state) => state.progress);
  const chapterHydrated = useChapter1((state) => state.hydrated);
  const application = useGigboardApplication((state) => state.application);
  const applicationHydrated = useGigboardApplication((state) => state.hydrated);
  const mailMessages = useMail((state) => state.messages);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [retryingQuest, setRetryingQuest] = useState(false);
  const [retryingMail, setRetryingMail] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    void useCafePayment.getState().hydrate();
    void useCafeSubmission.getState().hydrate();
    void useChapter1.getState().hydrate();
    void useGigboardApplication.getState().hydrate();
    void useMail.getState().hydrate();
  }, []);

  if (workflow !== "development" || submission?.reviewStatus !== "approved") return null;

  const eligibility = evaluateCafePaymentEligibility({
    applicationHydrated,
    applicationAccepted: application?.status === "accepted",
    chapterHydrated,
    chapter: chapterProgress,
    submissionHydrated,
    submission,
    paymentHydrated,
    payment,
    paymentInvalid,
    workflow,
  });
  const paid = payment !== null;
  const questRepairAvailable =
    paid && getCurrentChapter1Quest(chapterProgress)?.id === "CH1-07";
  const mailRetryAvailable =
    paid && !mailMessages.some((message) => message.id === CAFE_PAYMENT_MESSAGE_ID);
  const claimDisabled = !eligibility.eligible || claiming;

  const cancelConfirmation = () => {
    if (claiming) return;
    setConfirmOpen(false);
    setActionError(null);
  };

  const onDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") cancelConfirmation();
  };

  const handleClaim = async () => {
    if (claiming || claimDisabled) return;
    setClaiming(true);
    setActionError(null);
    try {
      const result = await claimCafePayment();
      if (!result.ok) {
        setActionError(result.reason);
        return;
      }
      setConfirmOpen(false);
      setSuccess(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setClaiming(false);
    }
  };

  const handleRetryQuest = async () => {
    if (retryingQuest) return;
    setRetryingQuest(true);
    setActionError(null);
    try {
      const result = await reconcileCafePaymentQuest();
      if (!result.ok) setActionError(result.reason);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setRetryingQuest(false);
    }
  };

  const handleRetryMail = async () => {
    if (retryingMail) return;
    setRetryingMail(true);
    setActionError(null);
    try {
      const result = await retryCafePaymentMail();
      if (!result.ok) setActionError(result.reason);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setRetryingMail(false);
    }
  };

  return (
    <section className="cq-gb-payment" aria-labelledby="cq-gb-payment-title" data-testid="cafe-payment-section">
      <div className="cq-gb-payment-head">
        <div>
          <span>Client payment</span>
          <h3 id="cq-gb-payment-title">First Paycheck</h3>
        </div>
        <strong
          className={`cq-gb-payment-status${paid ? " cq-gb-payment-status-paid" : ""}`}
          data-testid="cafe-payment-status"
        >
          {!paymentHydrated ? "Loading…" : paid ? "Paid" : "Available to Claim"}
        </strong>
      </div>

      <dl className="cq-gb-payment-meta">
        <div>
          <dt>Project</dt>
          <dd>{projectName}</dd>
        </div>
        <div>
          <dt>Client</dt>
          <dd>{clientName}</dd>
        </div>
        <div>
          <dt>Job ID</dt>
          <dd>{jobId}</dd>
        </div>
        <div>
          <dt>Project status</dt>
          <dd>Approved</dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>${CAFE_PAYMENT_AMOUNT}</dd>
        </div>
      </dl>

      {paid ? (
        <div className="cq-gb-payment-success" role="status" data-testid="cafe-payment-success">
          <CheckCircle2 size={16} aria-hidden="true" />
          <div>
            <strong>
              Payment received! {clientName} paid you ${CAFE_PAYMENT_AMOUNT} for the Café Order
              Calculator.
            </strong>
            <dl>
              <div>
                <dt>Amount received</dt>
                <dd>+${CAFE_PAYMENT_AMOUNT}</dd>
              </div>
              <div>
                <dt>Wallet balance</dt>
                <dd data-testid="cafe-payment-balance">${chapterProgress.money}</dd>
              </div>
              <div>
                <dt>Payment status</dt>
                <dd>Paid</dd>
              </div>
              <div>
                <dt>Next objective</dt>
                <dd>Return to your father</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : (
        <>
          <p className="cq-gb-payment-copy">
            {!paymentHydrated || !submissionHydrated || !chapterHydrated || !applicationHydrated ? (
              <>
                <Clock3 size={13} aria-hidden="true" /> Restoring your saved payment status…
              </>
            ) : (
              <>
                <Wallet size={13} aria-hidden="true" /> {eligibility.reason}
              </>
            )}
          </p>
          <button
            type="button"
            className="cq-gb-payment-action"
            onClick={() => {
              setActionError(null);
              setConfirmOpen(true);
            }}
            disabled={claimDisabled}
            data-testid="cafe-claim-payment"
          >
            Claim ${CAFE_PAYMENT_AMOUNT} Payment
          </button>
        </>
      )}

      {questRepairAvailable ? (
        <div className="cq-gb-payment-retry" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>Your payment is saved, but the Chapter 1 paycheck quest still needs updating.</span>
          <button
            type="button"
            onClick={() => void handleRetryQuest()}
            disabled={retryingQuest}
            data-testid="cafe-retry-payment-quest"
          >
            {retryingQuest ? "Retrying…" : "Retry Chapter 1 update"}
          </button>
        </div>
      ) : null}

      {mailRetryAvailable ? (
        <div className="cq-gb-payment-retry" role="alert">
          <Mail size={14} aria-hidden="true" />
          <span>Your $50 is paid, but the confirmation email could not be saved yet.</span>
          <button
            type="button"
            onClick={() => void handleRetryMail()}
            disabled={retryingMail}
            data-testid="cafe-retry-payment-mail"
          >
            {retryingMail ? "Retrying…" : "Retry payment email"}
          </button>
        </div>
      ) : null}

      {paymentError && !paymentHydrated ? (
        <p className="cq-gb-app-warning" role="alert">
          <AlertTriangle size={14} aria-hidden="true" /> {paymentError}
        </p>
      ) : null}
      {actionError ? (
        <p className="cq-gb-app-warning" role="alert" data-testid="cafe-payment-error">
          <AlertTriangle size={14} aria-hidden="true" /> {actionError}
        </p>
      ) : null}
      {success && !paid ? (
        <p className="cq-gb-payment-copy" role="status">
          <CheckCircle2 size={13} aria-hidden="true" /> Payment confirmation received.
        </p>
      ) : null}

      {confirmOpen && !paid ? (
        <div className="cq-gb-modal-backdrop">
          <div
            className="cq-gb-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cq-gb-payment-title-dialog"
            onKeyDown={onDialogKeyDown}
          >
            <div className="cq-gb-modal-form">
              <header className="cq-gb-modal-head">
                <div>
                  <span className="cq-gb-chip">Confirm payment</span>
                  <h2 id="cq-gb-payment-title-dialog">Claim ${CAFE_PAYMENT_AMOUNT}</h2>
                </div>
                <button
                  type="button"
                  className="cq-gb-modal-close"
                  aria-label="Close payment confirmation"
                  onClick={cancelConfirmation}
                  disabled={claiming}
                >
                  ×
                </button>
              </header>

              <dl className="cq-gb-payment-dialog-summary">
                <div>
                  <dt>Amount</dt>
                  <dd>${CAFE_PAYMENT_AMOUNT}</dd>
                </div>
                <div>
                  <dt>Client</dt>
                  <dd>{clientName}</dd>
                </div>
                <div>
                  <dt>Job ID</dt>
                  <dd>{jobId}</dd>
                </div>
              </dl>

              <p className="cq-gb-payment-dialog-copy">
                The ${CAFE_PAYMENT_AMOUNT} payment will be added to your in-game wallet. This can
                only be claimed once.
              </p>

              {actionError ? (
                <p className="cq-gb-form-error" role="alert">
                  <AlertTriangle size={14} aria-hidden="true" /> {actionError}
                </p>
              ) : null}

              <div className="cq-gb-modal-actions">
                <button
                  type="button"
                  className="cq-gb-cancel"
                  onClick={cancelConfirmation}
                  disabled={claiming}
                  data-testid="cafe-payment-cancel"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleClaim()}
                  disabled={claiming}
                  data-testid="cafe-payment-confirm"
                >
                  {claiming ? (
                    <>
                      <Loader2 size={14} className="cq-gb-spin" aria-hidden="true" /> Claiming…
                    </>
                  ) : (
                    "Confirm Payment"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
