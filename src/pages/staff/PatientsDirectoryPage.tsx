import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { StaffLayout } from '../../components/layout/StaffLayout';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import {
  formatDateDisplay,
  formatDateTimeDisplay,
  formatInr,
  humanizeStatus,
} from '../../lib/utils';

interface PatientListRow {
  id: string;
  patientCode: string;
  fullName: string;
  phone: string;
  email: string | null;
  consentAccepted: boolean;
  _count: { appointments: number; visits: number; reports: number };
}

interface PatientDetail {
  id: string;
  patientCode: string;
  fullName: string;
  phone: string;
  email: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  emergencyContact: string | null;
  referredBy: string | null;
  consentAccepted: boolean;
  consentTimestamp: string | null;
  appointments: Array<{
    id: string;
    bookingReference: string;
    appointmentDate: string;
    startTime: string;
    status: string;
    service: { name: string };
  }>;
  payments: Array<{
    id: string;
    receiptNumber: string | null;
    amountSubmittedInr: number;
    utrReference: string;
    status: string;
  }>;
  visits: Array<{
    id: string;
    visitNumber: string;
    status: string;
    checkedInAt: string;
    clinicalNotes: string | null;
    appointment: { bookingReference: string; service: { name: string } };
  }>;
  reports: Array<{
    id: string;
    reportCode: string;
    title: string;
    revisionNumber: number;
    status: string;
    visit: { visitNumber: string; appointment: { bookingReference: string } };
  }>;
}

interface DuplicateGroup {
  matchReason: string;
  patients: Array<{
    id: string;
    patientCode: string;
    fullName: string;
    phone: string;
    email: string | null;
    _count: { appointments: number; visits: number; reports: number; payments: number };
  }>;
}

export function PatientsDirectoryPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canMerge = user?.role === 'SUPER_ADMIN' || user?.role === 'RECEPTION';
  const canEdit = canMerge;

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Registration state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDob, setNewDob] = useState('');
  const [newGender, setNewGender] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newRef, setNewRef] = useState('');
  const [newConsent, setNewConsent] = useState(true);
  const [allowDup, setAllowDup] = useState(false);

  // Duplicate & Merge Dialog
  const [dupDialogOpen, setDupDialogOpen] = useState(false);
  const [mergeReason, setMergeReason] = useState('Consolidated duplicate patient registration');

  // Edit Profile Dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    emergencyContact: '',
    referredBy: '',
    consentAccepted: true,
  });

  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['staff-patients', search],
    queryFn: () =>
      apiFetch<{ patients: PatientListRow[] }>(
        `/api/v1/patients?q=${encodeURIComponent(search)}`
      ),
  });

  const { data: detailData } = useQuery({
    queryKey: ['staff-patient-detail', selectedId],
    queryFn: () =>
      apiFetch<{ patient: PatientDetail }>(`/api/v1/patients/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  const { data: dupData, refetch: refetchDups } = useQuery({
    queryKey: ['staff-patient-duplicates'],
    queryFn: () =>
      apiFetch<{ duplicateGroups: DuplicateGroup[] }>('/api/v1/patients/duplicates'),
    enabled: canEdit && dupDialogOpen,
  });

  const handleCreatePatient = async () => {
    if (!newName.trim() || !newPhone.trim()) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{ patient: { id: string; patientCode: string } }>(
        '/api/v1/patients',
        {
          method: 'POST',
          body: JSON.stringify({
            fullName: newName,
            phone: newPhone,
            email: newEmail,
            dateOfBirth: newDob || undefined,
            gender: newGender || undefined,
            address: newAddress || undefined,
            referredBy: newRef,
            consentAccepted: newConsent,
            allowDuplicate: allowDup,
          }),
        }
      );
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewDob('');
      setNewGender('');
      setNewAddress('');
      setNewRef('');
      setAllowDup(false);
      setSelectedId(res.patient.id);
      setFeedback(`Registered patient record ${res.patient.patientCode}.`);
      await queryClient.invalidateQueries({ queryKey: ['staff-patients'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create patient record.');
    }
  };

  const openEditDialog = (pt: PatientDetail) => {
    setEditForm({
      fullName: pt.fullName,
      phone: pt.phone,
      email: pt.email || '',
      dateOfBirth: pt.dateOfBirth || '',
      gender: pt.gender || '',
      address: pt.address || '',
      emergencyContact: pt.emergencyContact || '',
      referredBy: pt.referredBy || '',
      consentAccepted: pt.consentAccepted,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedId) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/v1/patients/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: editForm.fullName,
          phone: editForm.phone,
          email: editForm.email,
          dateOfBirth: editForm.dateOfBirth || null,
          gender: editForm.gender || null,
          address: editForm.address || null,
          emergencyContact: editForm.emergencyContact || null,
          referredBy: editForm.referredBy || null,
          consentAccepted: editForm.consentAccepted,
        }),
      });
      setEditOpen(false);
      setFeedback('Patient demographics and consent record updated.');
      await queryClient.invalidateQueries({ queryKey: ['staff-patient-detail', selectedId] });
      await queryClient.invalidateQueries({ queryKey: ['staff-patients'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update patient.');
    }
  };

  const handleMergePair = async (sourceId: string, targetId: string) => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{
        patient: { id: string; patientCode: string };
        mergedFromCode: string;
      }>('/api/v1/patients/merge', {
        method: 'POST',
        body: JSON.stringify({
          sourcePatientId: sourceId,
          targetPatientId: targetId,
          reason: mergeReason,
        }),
      });
      setSelectedId(res.patient.id);
      setFeedback(`Merged ${res.mergedFromCode} into ${res.patient.patientCode}.`);
      await refetchDups();
      await queryClient.invalidateQueries({ queryKey: ['staff-patients'] });
      await queryClient.invalidateQueries({ queryKey: ['staff-patient-detail', res.patient.id] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Merge failed.');
    }
  };

  const detail = detailData?.patient;

  return (
    <StaffLayout title="Patient Management System" breadcrumb="Operations / Patients">
      <div className="space-y-4">
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-4">
            {canEdit && (
              <div className="rounded-lg border border-[#DCE7E9] bg-white p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-sm font-semibold text-[#083642]">
                    Register New Patient
                  </h2>
                  {canMerge && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDupDialogOpen(true)}
                    >
                      Duplicate Check &amp; Merge
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Full Name</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Mobile</Label>
                    <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                  </div>
                  <div>
                    <Label>Email (Optional)</Label>
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Referred By</Label>
                    <Input value={newRef} onChange={(e) => setNewRef(e.target.value)} />
                  </div>
                  <div>
                    <Label>Date of Birth</Label>
                    <Input
                      type="date"
                      value={newDob}
                      onChange={(e) => setNewDob(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <Select value={newGender} onChange={(e) => setNewGender(e.target.value)}>
                      <option value="">Select</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Address (Optional)</Label>
                  <Input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <label className="flex items-center gap-2 text-[#24343B] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newConsent}
                      onChange={(e) => setNewConsent(e.target.checked)}
                    />
                    <span>Patient Consent Recorded</span>
                  </label>
                  <label className="flex items-center gap-2 text-[#65747B] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowDup}
                      onChange={(e) => setAllowDup(e.target.checked)}
                    />
                    <span>Allow separate record on shared phone</span>
                  </label>
                </div>

                <Button type="button" size="sm" onClick={handleCreatePatient}>
                  Create Patient Record
                </Button>
              </div>
            )}

            <div className="rounded-lg border border-[#DCE7E9] bg-white p-4 space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65747B]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by ID, name, email, or phone..."
                  className="pl-9"
                />
              </div>

              <div className="divide-y divide-[#E9F3F3] max-h-[460px] overflow-y-auto">
                {(data?.patients ?? []).map((pt) => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => setSelectedId(pt.id)}
                    className={`w-full text-left py-3 px-2 rounded transition-colors cursor-pointer ${
                      selectedId === pt.id ? 'bg-[#E9F3F3]' : 'hover:bg-[#F8FAFA]'
                    }`}
                  >
                    <p className="font-mono-tabular text-xs text-[#287887]">
                      {pt.patientCode} · {pt.phone}
                    </p>
                    <p className="text-sm font-semibold text-[#083642]">{pt.fullName}</p>
                    <p className="text-[11px] text-[#65747B]">
                      {pt._count.appointments} appts · {pt._count.visits} visits ·{' '}
                      {pt._count.reports} reports
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            {!detail ? (
              <div className="rounded-lg border border-[#DCE7E9] bg-white p-10 text-center text-xs text-[#65747B]">
                Select a patient from the directory to view demographics, consent records, appointment history, clinical visits, payment receipts, and authorized document references.
              </div>
            ) : (
              <div className="rounded-lg border border-[#DCE7E9] bg-white p-6 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#DCE7E9] pb-4">
                  <div>
                    <p className="font-mono-tabular text-xs font-semibold text-[#287887]">
                      {detail.patientCode} · Consent:{' '}
                      {detail.consentAccepted
                        ? `Recorded${detail.consentTimestamp ? ` (${formatDateTimeDisplay(detail.consentTimestamp)})` : ''}`
                        : 'Pending'}
                    </p>
                    <h2 className="mt-1 font-display text-xl font-bold text-[#083642]">
                      {detail.fullName}
                    </h2>
                    <p className="text-xs text-[#65747B]">
                      Phone: <span className="font-mono-tabular">{detail.phone}</span>
                      {detail.email ? ` · ${detail.email}` : ''}
                      {detail.gender ? ` · ${detail.gender}` : ''}
                      {detail.dateOfBirth ? ` · DOB ${formatDateDisplay(detail.dateOfBirth)}` : ''}
                      {detail.referredBy ? ` · Referred by ${detail.referredBy}` : ''}
                    </p>
                    {(detail.address || detail.emergencyContact) && (
                      <p className="mt-1 text-xs text-[#65747B]">
                        {detail.address ? `Address: ${detail.address}` : ''}
                        {detail.address && detail.emergencyContact ? ' · ' : ''}
                        {detail.emergencyContact
                          ? `Emergency Contact: ${detail.emergencyContact}`
                          : ''}
                      </p>
                    )}
                  </div>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(detail)}
                    >
                      Edit Profile &amp; Consent
                    </Button>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-[#083642]">Appointments</h3>
                  <div className="mt-2 divide-y divide-[#E9F3F3] text-xs">
                    {detail.appointments.length === 0 ? (
                      <p className="text-[#65747B]">None recorded.</p>
                    ) : (
                      detail.appointments.map((a) => (
                        <div key={a.id} className="py-2 flex justify-between gap-2">
                          <span>
                            <strong className="font-mono-tabular">{a.bookingReference}</strong> ·{' '}
                            {a.service.name}
                          </span>
                          <span className="font-mono-tabular text-[#65747B]">
                            {formatDateDisplay(a.appointmentDate)} {a.startTime} ·{' '}
                            {humanizeStatus(a.status)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-[#083642]">Visit History</h3>
                  <div className="mt-2 divide-y divide-[#E9F3F3] text-xs">
                    {detail.visits.length === 0 ? (
                      <p className="text-[#65747B]">No clinical visits checked in yet.</p>
                    ) : (
                      detail.visits.map((v) => (
                        <div key={v.id} className="py-2 space-y-1">
                          <div className="flex justify-between gap-2">
                            <span>
                              <strong className="font-mono-tabular">{v.visitNumber}</strong> ·{' '}
                              {v.appointment.service.name} ({v.appointment.bookingReference})
                            </span>
                            <span className="font-mono-tabular text-[#65747B]">
                              {formatDateTimeDisplay(v.checkedInAt)} · {humanizeStatus(v.status)}
                            </span>
                          </div>
                          {v.clinicalNotes && (
                            <p className="text-[#083642] bg-[#F8FAFA] border border-[#E9F3F3] rounded px-2.5 py-1.5">
                              Clinical Note: {v.clinicalNotes}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-[#083642]">Payments</h3>
                  <div className="mt-2 divide-y divide-[#E9F3F3] text-xs">
                    {detail.payments.length === 0 ? (
                      <p className="text-[#65747B]">No payment history.</p>
                    ) : (
                      detail.payments.map((p) => (
                        <div key={p.id} className="py-2 flex justify-between font-mono-tabular">
                          <span>
                            UTR {p.utrReference} {p.receiptNumber ? `(${p.receiptNumber})` : ''}
                          </span>
                          <span>
                            {formatInr(p.amountSubmittedInr)} · {humanizeStatus(p.status)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-[#083642]">
                    Authorized Diagnostic Document Records
                  </h3>
                  <div className="mt-2 divide-y divide-[#E9F3F3] text-xs">
                    {detail.reports.length === 0 ? (
                      <p className="text-[#65747B]">No diagnostic reports uploaded.</p>
                    ) : (
                      detail.reports.map((r) => (
                        <div key={r.id} className="py-2 flex justify-between gap-2">
                          <span>
                            <span className="font-mono-tabular">{r.reportCode}</span> (Rev{' '}
                            {r.revisionNumber}) · {r.visit.visitNumber} ·{' '}
                            {r.visit.appointment.bookingReference} - {r.title}
                          </span>
                          <span className="font-mono-tabular text-[#0D4A5A]">
                            {humanizeStatus(r.status)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Duplicate Detection & Merge Dialog */}
      <Dialog
        open={dupDialogOpen}
        onClose={() => setDupDialogOpen(false)}
        title="Duplicate Patient Detection & Record Merge"
        description="Review potential duplicate patient profiles sharing mobile numbers or email addresses, and merge secondary duplicates into the primary record."
        className="max-w-2xl max-h-[85vh] overflow-y-auto"
      >
        <div className="space-y-4 text-xs">
          <div>
            <Label>Audit Reason for Merge</Label>
            <Input
              value={mergeReason}
              onChange={(e) => setMergeReason(e.target.value)}
              placeholder="Reason recorded in security audit log"
            />
          </div>

          {(dupData?.duplicateGroups ?? []).length === 0 ? (
            <p className="rounded border border-[#DCE7E9] bg-[#F8FAFA] p-4 text-[#65747B]">
              No duplicate phone or email patient groups detected.
            </p>
          ) : (
            <div className="space-y-4">
              {dupData?.duplicateGroups.map((group) => {
                const primary = group.patients[0];
                return (
                  <div
                    key={group.matchReason}
                    className="rounded-md border border-[#DCE7E9] p-4 space-y-3"
                  >
                    <p className="font-semibold text-[#083642]">{group.matchReason}</p>
                    <div className="divide-y divide-[#E9F3F3]">
                      {group.patients.map((pt, idx) => (
                        <div
                          key={pt.id}
                          className="py-2 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div>
                            <p className="font-mono-tabular font-semibold text-[#0D4A5A]">
                              {pt.patientCode} · {pt.fullName}
                            </p>
                            <p className="text-[#65747B]">
                              {pt.phone}
                              {pt.email ? ` · ${pt.email}` : ''} · {pt._count.appointments} appts ·{' '}
                              {pt._count.reports} reports
                            </p>
                          </div>
                          {idx === 0 ? (
                            <span className="font-mono-tabular text-[#287887]">
                              Primary Target
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleMergePair(pt.id, primary.id)}
                            >
                              Merge into {primary.patientCode}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Dialog>

      {/* Edit Profile & Consent Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Patient Profile & Consent"
        description={detail ? `${detail.patientCode} · ${detail.fullName}` : undefined}
        className="max-w-lg"
      >
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Full Name</Label>
              <Input
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Date of Birth</Label>
              <Input
                type="date"
                value={editForm.dateOfBirth}
                onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
              />
            </div>
            <div>
              <Label>Gender</Label>
              <Select
                value={editForm.gender}
                onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
              >
                <option value="">Unspecified</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </Select>
            </div>
            <div>
              <Label>Emergency Contact</Label>
              <Input
                value={editForm.emergencyContact}
                onChange={(e) =>
                  setEditForm({ ...editForm, emergencyContact: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <Label>Address</Label>
            <Input
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            />
          </div>
          <div>
            <Label>Referred By</Label>
            <Input
              value={editForm.referredBy}
              onChange={(e) => setEditForm({ ...editForm, referredBy: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-[#24343B] cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={editForm.consentAccepted}
              onChange={(e) =>
                setEditForm({ ...editForm, consentAccepted: e.target.checked })
              }
            />
            <span>Patient Diagnostic &amp; Privacy Consent Accepted</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveEdit}>
              Save Patient Record
            </Button>
          </div>
        </div>
      </Dialog>
    </StaffLayout>
  );
}
