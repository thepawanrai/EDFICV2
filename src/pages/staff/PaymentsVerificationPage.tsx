import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileCheck2, RotateCcw } from 'lucide-react';
import { StaffLayout } from '../../components/layout/StaffLayout';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { formatDateDisplay, formatDateTimeDisplay, formatInr, humanizeStatus } from '../../lib/utils';

interface PaymentRow {
  id: string;
  receiptNumber: string | null;
  paymentMethod: string;
  expectedAdvanceInr: number;
  amountSubmittedInr: number;
  totalServiceFeeInr: number;
  utrReference: string;
  paymentDate: string;
  evidenceFilePath: string | null;
  status: string;
  rejectionReason: string | null;
  refundedAt?: string | null;
  refundReason?: string | null;
  appointment: {
    bookingReference: string;
    appointmentDate: string;
    startTime: string;
    status: string;
    service: { name: string };
  };
  patient: {
    patientCode: string;
    fullName: string;
    phone: string;
  };
  verifiedBy: { fullName: string } | null;
}

interface ReceiptDetails {
  receiptNumber: string | null;
  status: string;
  paymentMethod: string;
  utrReference: string;
  paymentDate: string;
  amountPaidInr: number;
  totalServiceFeeInr: number;
  totalVerifiedPaidInr: number;
  balanceDueInr: number;
  verifiedAt: string | null;
  verifiedBy: string | null;
  bookingReference: string;
  appointmentDate: string;
  startTime: string;
  serviceName: string;
  patient: {
    patientCode: string;
    fullName: string;
    phone: string;
  };
}

type PaymentFilter =
  | 'AWAITING_REVIEW'
  | 'SUBMITTED'
  | 'UNDER_VERIFICATION'
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'REFUNDED'
  | 'ALL';

const REVIEWABLE_STATUSES = ['PENDING', 'SUBMITTED', 'UNDER_VERIFICATION'];

export function PaymentsVerificationPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<PaymentFilter>('AWAITING_REVIEW');
  const [serviceFees, setServiceFees] = useState<Record<string, string>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [receiptTarget, setReceiptTarget] = useState<ReceiptDetails | null>(null);
  const [refundTarget, setRefundTarget] = useState<PaymentRow | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canRefund = user?.role === 'SUPER_ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['staff-payments'],
    queryFn: () => apiFetch<{ payments: PaymentRow[] }>('/api/v1/payments'),
  });

  const payments = (data?.payments ?? []).filter((p) => {
    if (filter === 'ALL') return true;
    if (filter === 'AWAITING_REVIEW') return REVIEWABLE_STATUSES.includes(p.status);
    return p.status === filter;
  });

  const handleMarkUnderVerification = async (payment: PaymentRow) => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/v1/payments/${payment.id}/under-verification`, {
        method: 'POST',
      });
      setFeedback(`Payment ${payment.utrReference} marked as Under Verification.`);
      await queryClient.invalidateQueries({ queryKey: ['staff-payments'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Status update failed.');
    }
  };

  const handleVerify = async (payment: PaymentRow) => {
    setErrorMsg(null);
    setFeedback(null);
    const feeVal = Number(serviceFees[payment.id] || payment.totalServiceFeeInr || 0);
    try {
      const res = await apiFetch<{ payment: { receiptNumber: string } }>(
        `/api/v1/payments/${payment.id}/verify`,
        {
          method: 'POST',
          body: JSON.stringify({ totalServiceFeeInr: feeVal }),
        }
      );
      setFeedback(
        `Verified UTR ${payment.utrReference}. Receipt ${res.payment.receiptNumber} generated & appointment confirmed.`
      );
      await queryClient.invalidateQueries({ queryKey: ['staff-payments'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification failed.');
    }
  };

  const handleReject = async (payment: PaymentRow) => {
    setErrorMsg(null);
    setFeedback(null);
    const reason = rejectReasons[payment.id] || 'UTR not matched in bank statement';
    try {
      await apiFetch(`/api/v1/payments/${payment.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ rejectionReason: reason }),
      });
      setFeedback(`Payment ${payment.utrReference} marked as Rejected.`);
      await queryClient.invalidateQueries({ queryKey: ['staff-payments'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Rejection failed.');
    }
  };

  const handleOpenReceipt = async (paymentId: string) => {
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ receipt: ReceiptDetails }>(
        `/api/v1/payments/${paymentId}/receipt`
      );
      setReceiptTarget(res.receipt);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not load receipt.');
    }
  };

  const handleConfirmRefund = async () => {
    if (!refundTarget) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/v1/payments/${refundTarget.id}/refund`, {
        method: 'POST',
        body: JSON.stringify({
          refundReason: refundReason.trim() || 'Refund processed by Super Admin',
        }),
      });
      setFeedback(
        `Payment ${refundTarget.receiptNumber || refundTarget.utrReference} marked as Refunded.`
      );
      setRefundTarget(null);
      setRefundReason('');
      await queryClient.invalidateQueries({ queryKey: ['staff-payments'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Refund failed.');
    }
  };

  const filterTabs: Array<{ key: PaymentFilter; label: string }> = [
    { key: 'AWAITING_REVIEW', label: 'Awaiting Review' },
    { key: 'SUBMITTED', label: 'Submitted' },
    { key: 'UNDER_VERIFICATION', label: 'Under Verification' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'VERIFIED', label: 'Verified' },
    { key: 'REJECTED', label: 'Rejected' },
    { key: 'REFUNDED', label: 'Refunded' },
    { key: 'ALL', label: 'All Records' },
  ];

  return (
    <StaffLayout
      title="UPI Advance Payment Verification"
      breadcrumb="Operations / Payments"
    >
      <div className="space-y-6">
        <div className="rounded-lg border border-[#DCE7E9] bg-[#E9F3F3]/70 p-4 text-xs text-[#083642]">
          <strong>Manual Verification Policy:</strong> Uploading a screenshot or UTR never confirms an appointment automatically. Verify the UTR against the EDFIC clinic bank/UPI statement before clicking Verify &amp; Confirm Slot.
        </div>

        {feedback && (
          <div className="rounded-md border border-[#287887] bg-[#E9F3F3] p-3 text-xs text-[#083642]">
            {feedback}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-md border border-[#B42318]/40 bg-[#FEF3F2] p-3 text-xs text-[#B42318]">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-wrap gap-1 rounded-lg bg-[#E9F3F3] p-1 w-fit">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                filter === tab.key ? 'bg-white text-[#0D4A5A] shadow-sm' : 'text-[#65747B]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-8 text-xs text-[#65747B]">
            Loading payment records...
          </div>
        ) : payments.length === 0 ? (
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-8 text-center text-xs text-[#65747B]">
            No payment entries under {humanizeStatus(filter)}.
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((pay) => {
              const fee = Number(serviceFees[pay.id] ?? pay.totalServiceFeeInr ?? 0);
              const balance = Math.max(0, fee - pay.amountSubmittedInr);
              const isReviewable = REVIEWABLE_STATUSES.includes(pay.status);

              return (
                <div
                  key={pay.id}
                  className="rounded-lg border border-[#DCE7E9] bg-white p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-mono-tabular text-xs font-semibold text-[#287887]">
                        {pay.appointment.bookingReference} · {pay.paymentMethod} · Ref {pay.utrReference} ·{' '}
                        {humanizeStatus(pay.status)}
                      </p>
                      <h3 className="font-display text-base font-semibold text-[#083642]">
                        {pay.patient.fullName} ({pay.patient.patientCode})
                      </h3>
                      <p className="text-xs text-[#65747B]">
                        {pay.appointment.service.name} ·{' '}
                        {formatDateDisplay(pay.appointment.appointmentDate)} at{' '}
                        <span className="font-mono-tabular">{pay.appointment.startTime}</span>
                      </p>
                      {pay.rejectionReason && (
                        <p className="text-xs text-[#B42318]">
                          Rejection note: {pay.rejectionReason}
                        </p>
                      )}
                      {pay.refundReason && (
                        <p className="text-xs text-[#65747B]">
                          Refund reason: {pay.refundReason}
                        </p>
                      )}
                    </div>

                    <div className="text-right font-mono-tabular text-xs space-y-1">
                      <p className="text-sm font-bold text-[#083642]">
                        Submitted: {formatInr(pay.amountSubmittedInr)}
                      </p>
                      <p className="text-[#65747B]">
                        Expected Advance: {formatInr(pay.expectedAdvanceInr)} · Paid on{' '}
                        {formatDateDisplay(pay.paymentDate)}
                      </p>
                      {pay.receiptNumber && (
                        <p className="text-[#0D4A5A] font-semibold">
                          Receipt: {pay.receiptNumber}
                        </p>
                      )}
                      {pay.totalServiceFeeInr > 0 && (
                        <p className="text-[#24343B]">
                          Total Fee: {formatInr(pay.totalServiceFeeInr)} · Balance Due:{' '}
                          {formatInr(Math.max(0, pay.totalServiceFeeInr - pay.amountSubmittedInr))}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E9F3F3] pt-3">
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      {pay.evidenceFilePath ? (
                        <a
                          href={`/api/v1/payments/${pay.id}/evidence`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 font-medium text-[#0D4A5A] hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Inspect Uploaded Payment Evidence</span>
                        </a>
                      ) : (
                        <span className="text-[#65747B]">No screenshot uploaded</span>
                      )}

                      {(pay.status === 'VERIFIED' || pay.status === 'REFUNDED') && (
                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(pay.id)}
                          className="inline-flex items-center gap-1.5 font-medium text-[#0D4A5A] hover:underline cursor-pointer"
                        >
                          <FileCheck2 className="h-3.5 w-3.5" />
                          <span>View Payment Receipt &amp; Balance</span>
                        </button>
                      )}
                    </div>

                    {isReviewable && (
                      <div className="flex flex-wrap items-center gap-2">
                        {pay.status !== 'UNDER_VERIFICATION' && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkUnderVerification(pay)}
                          >
                            Mark Under Verification
                          </Button>
                        )}
                        <Input
                          type="number"
                          placeholder="Total Fee (INR)"
                          value={serviceFees[pay.id] ?? ''}
                          onChange={(e) =>
                            setServiceFees((prev) => ({
                              ...prev,
                              [pay.id]: e.target.value,
                            }))
                          }
                          className="h-9 w-36 text-xs"
                        />
                        {fee > 0 && (
                          <span className="text-[11px] font-mono-tabular text-[#65747B]">
                            Bal: {formatInr(balance)}
                          </span>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleVerify(pay)}
                        >
                          Verify &amp; Confirm Slot
                        </Button>
                        <Input
                          placeholder="Rejection note"
                          value={rejectReasons[pay.id] ?? ''}
                          onChange={(e) =>
                            setRejectReasons((prev) => ({
                              ...prev,
                              [pay.id]: e.target.value,
                            }))
                          }
                          className="h-9 w-40 text-xs"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleReject(pay)}
                        >
                          Reject
                        </Button>
                      </div>
                    )}

                    {pay.status === 'VERIFIED' && canRefund && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRefundTarget(pay);
                          setRefundReason('');
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Mark Refunded</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Receipt & Balance Dialog */}
      <Dialog
        open={Boolean(receiptTarget)}
        onClose={() => setReceiptTarget(null)}
        title="EDFIC Official Advance Payment Receipt"
        description="EWA Diagnostic and Fetal Imaging Centre - A Unit of EWA DERMA"
      >
        {receiptTarget && (
          <div className="space-y-4 text-xs">
            <div className="rounded-md border border-[#DCE7E9] bg-[#F8FAFA] p-4 space-y-1.5">
              <p className="font-mono-tabular font-bold text-sm text-[#0D4A5A]">
                {receiptTarget.receiptNumber || 'Pending Receipt'}
              </p>
              <p className="text-[#65747B]">
                Unit 10, Millennium Place, Sushant Golf City, Near Lulu Mall, Lucknow
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 border-b border-[#E9F3F3] pb-3">
              <div>
                <p className="text-[#65747B]">Patient</p>
                <p className="font-semibold text-[#083642]">
                  {receiptTarget.patient.fullName} ({receiptTarget.patient.patientCode})
                </p>
              </div>
              <div>
                <p className="text-[#65747B]">Booking Reference</p>
                <p className="font-mono-tabular font-semibold text-[#083642]">
                  {receiptTarget.bookingReference}
                </p>
              </div>
              <div>
                <p className="text-[#65747B]">Investigation</p>
                <p className="font-medium text-[#24343B]">{receiptTarget.serviceName}</p>
              </div>
              <div>
                <p className="text-[#65747B]">Scheduled Slot</p>
                <p className="font-mono-tabular font-medium text-[#24343B]">
                  {formatDateDisplay(receiptTarget.appointmentDate)} · {receiptTarget.startTime}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 font-mono-tabular">
              <div className="flex justify-between">
                <span className="text-[#65747B]">Payment Method &amp; Reference</span>
                <span>
                  {receiptTarget.paymentMethod} · {receiptTarget.utrReference}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65747B]">Payment Status</span>
                <span className="font-semibold text-[#0D4A5A]">
                  {humanizeStatus(receiptTarget.status)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65747B]">Amount Paid (This Receipt)</span>
                <span className="font-bold text-[#083642]">
                  {formatInr(receiptTarget.amountPaidInr)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65747B]">Total Verified Paid</span>
                <span>{formatInr(receiptTarget.totalVerifiedPaidInr)}</span>
              </div>
              {receiptTarget.totalServiceFeeInr > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#65747B]">Total Investigation Fee</span>
                    <span>{formatInr(receiptTarget.totalServiceFeeInr)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#DCE7E9] pt-1.5 font-bold text-[#083642]">
                    <span>Balance Payable at Reception</span>
                    <span>{formatInr(receiptTarget.balanceDueInr)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between pt-2 text-[11px] text-[#65747B]">
                <span>Verified By: {receiptTarget.verifiedBy || 'EDFIC Desk'}</span>
                <span>{formatDateTimeDisplay(receiptTarget.verifiedAt)}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setReceiptTarget(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Refund Confirmation Dialog */}
      <Dialog
        open={Boolean(refundTarget)}
        onClose={() => setRefundTarget(null)}
        title="Record Payment Refund"
        description={
          refundTarget
            ? `${refundTarget.receiptNumber || refundTarget.utrReference} · ${formatInr(refundTarget.amountSubmittedInr)}`
            : undefined
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="refundReason">Refund Reason</Label>
            <Input
              id="refundReason"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="e.g., Appointment cancelled by patient, UPI reversed"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRefundTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={refundReason.trim().length < 4}
              onClick={handleConfirmRefund}
            >
              Confirm Refund
            </Button>
          </div>
        </div>
      </Dialog>
    </StaffLayout>
  );
}
