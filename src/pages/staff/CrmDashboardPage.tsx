import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { StaffLayout } from '../../components/layout/StaffLayout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { apiFetch } from '../../lib/api';
import { formatDateDisplay, formatDateTimeDisplay, humanizeStatus } from '../../lib/utils';

interface CrmAssignee {
  id: string;
  fullName: string;
  role: string;
  email: string;
}

interface CrmLead {
  id: string;
  leadCode: string;
  fullName: string;
  phone: string;
  email: string | null;
  source: string;
  interestedService: string | null;
  message: string | null;
  status: string;
  notes: string | null;
  followUpDueAt: string | null;
  assignedTo: { id: string; fullName: string; role: string } | null;
  convertedPatient: { id: string; patientCode: string; fullName: string } | null;
  linkedAppointment: {
    id: string;
    bookingReference: string;
    appointmentDate: string;
    startTime: string;
    status: string;
    service: { name: string };
  } | null;
  tasks: Array<{
    id: string;
    title: string;
    dueAt: string | null;
    isCompleted: boolean;
    assignedTo: { id: string; fullName: string } | null;
  }>;
  createdAt: string;
}

const STAGE_OPTIONS = [
  'NEW',
  'CONTACTED',
  'INFORMATION_PROVIDED',
  'APPOINTMENT_REQUESTED',
  'APPOINTMENT_CONFIRMED',
  'VISITED',
  'FOLLOW_UP',
  'SCHEDULED',
  'CONVERTED',
  'CLOSED',
] as const;

export function CrmDashboardPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [interestedService, setInterestedService] = useState('');
  const [source, setSource] = useState('WALK_IN');
  const [newAssignedToId, setNewAssignedToId] = useState('');
  const [newFollowUpDue, setNewFollowUpDue] = useState('');

  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});
  const [taskDueInputs, setTaskDueInputs] = useState<Record<string, string>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [linkRefInputs, setLinkRefInputs] = useState<Record<string, string>>({});

  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: assigneesData } = useQuery({
    queryKey: ['crm-assignees'],
    queryFn: () => apiFetch<{ users: CrmAssignee[] }>('/api/v1/crm/assignees'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['crm-leads', statusFilter, sourceFilter, assigneeFilter, searchQuery],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (sourceFilter !== 'ALL') params.set('source', sourceFilter);
      if (assigneeFilter !== 'ALL') params.set('assignedToId', assigneeFilter);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      const qs = params.toString();
      return apiFetch<{ leads: CrmLead[] }>(`/api/v1/crm${qs ? `?${qs}` : ''}`);
    },
  });

  const leads = data?.leads ?? [];
  const assignees = assigneesData?.users ?? [];

  const handleCreateLead = async () => {
    setErrorMsg(null);
    setFeedback(null);
    if (!fullName.trim() || !phone.trim()) return;
    try {
      await apiFetch('/api/v1/crm', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          phone,
          interestedService,
          source,
          ...(newAssignedToId ? { assignedToId: newAssignedToId } : {}),
          ...(newFollowUpDue ? { followUpDueAt: new Date(newFollowUpDue).toISOString() } : {}),
        }),
      });
      setFullName('');
      setPhone('');
      setInterestedService('');
      setNewFollowUpDue('');
      setFeedback('New CRM inquiry logged.');
      await queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create inquiry.');
    }
  };

  const handleUpdateLead = async (
    id: string,
    payload: {
      status?: string;
      notes?: string;
      assignedToId?: string | null;
      followUpDueAt?: string | null;
    }
  ) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/v1/crm/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update inquiry.');
    }
  };

  const handleLinkAppointment = async (leadId: string) => {
    const ref = linkRefInputs[leadId]?.trim();
    if (!ref) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{
        lead: { leadCode: string; linkedAppointment?: { bookingReference: string } | null };
      }>(`/api/v1/crm/${leadId}/link-appointment`, {
        method: 'POST',
        body: JSON.stringify({ bookingReference: ref }),
      });
      setLinkRefInputs((prev) => ({ ...prev, [leadId]: '' }));
      setFeedback(
        `Linked appointment ${res.lead.linkedAppointment?.bookingReference ?? ref} to lead ${res.lead.leadCode}.`
      );
      await queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not link appointment.');
    }
  };

  const handleAddTask = async (leadId: string) => {
    const title = taskInputs[leadId]?.trim();
    if (!title) return;
    setErrorMsg(null);
    try {
      const dueRaw = taskDueInputs[leadId];
      await apiFetch(`/api/v1/crm/${leadId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          ...(dueRaw ? { dueAt: new Date(dueRaw).toISOString() } : {}),
        }),
      });
      setTaskInputs((prev) => ({ ...prev, [leadId]: '' }));
      setTaskDueInputs((prev) => ({ ...prev, [leadId]: '' }));
      await queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to add follow-up task.');
    }
  };

  const handleToggleTask = async (taskId: string) => {
    await apiFetch(`/api/v1/crm/tasks/${taskId}/toggle`, { method: 'PATCH' });
    await queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
  };

  const handleConvert = async (leadId: string) => {
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ patient: { patientCode: string } }>(
        `/api/v1/crm/${leadId}/convert`,
        { method: 'POST' }
      );
      setFeedback(`Lead converted to Patient Record ${res.patient.patientCode}.`);
      await queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Conversion failed.');
    }
  };

  return (
    <StaffLayout title="Integrated CRM & Inquiries" breadcrumb="Operations / CRM">
      <div className="space-y-6">
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

        {/* Log Walk-in / Phone Lead */}
        <div className="rounded-lg border border-[#DCE7E9] bg-white p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-[#083642]">
            Log Walk-In or Phone Inquiry
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-7 items-end">
            <div>
              <Label>Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>Source</Label>
              <Select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="WALK_IN">Walk-In</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="REFERRAL">Doctor Referral</option>
                <option value="BOOKING_INQUIRY">Phone Inquiry</option>
                <option value="WEBSITE_CONTACT">Website Contact</option>
              </Select>
            </div>
            <div>
              <Label>Service Interest</Label>
              <Input
                value={interestedService}
                onChange={(e) => setInterestedService(e.target.value)}
                placeholder="e.g., Anomaly Scan"
              />
            </div>
            <div>
              <Label>Assign Staff</Label>
              <Select
                value={newAssignedToId}
                onChange={(e) => setNewAssignedToId(e.target.value)}
              >
                <option value="">Auto (Current User)</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Follow-Up Due</Label>
              <Input
                type="date"
                value={newFollowUpDue}
                onChange={(e) => setNewFollowUpDue(e.target.value)}
              />
            </div>
            <Button type="button" onClick={handleCreateLead}>
              Add Inquiry
            </Button>
          </div>
        </div>

        {/* Search & Filtering Bar */}
        <div className="rounded-lg border border-[#DCE7E9] bg-white p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65747B]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search lead code, name, phone, or investigation..."
                className="pl-9"
              />
            </div>
            <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="ALL">All Lead Sources</option>
              <option value="WEBSITE_CONTACT">Website Contact</option>
              <option value="BOOKING_INQUIRY">Booking / Phone Inquiry</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="REFERRAL">Doctor Referral</option>
              <option value="WALK_IN">Walk-In</option>
            </Select>
            <Select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
              <option value="ALL">All Assignees</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-wrap gap-1 rounded-lg bg-[#E9F3F3] p-1 w-fit">
            {['ALL', ...STAGE_OPTIONS].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                  statusFilter === st ? 'bg-white text-[#0D4A5A] shadow-sm' : 'text-[#65747B]'
                }`}
              >
                {st === 'ALL' ? 'All Stages' : humanizeStatus(st)}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-6 text-xs text-[#65747B]">
            Loading CRM pipeline...
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-8 text-center text-xs text-[#65747B]">
            No inquiries match your current search or stage filter.
          </div>
        ) : (
          <div className="space-y-4">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="rounded-lg border border-[#DCE7E9] bg-white p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-mono-tabular text-xs text-[#287887]">
                      {lead.leadCode} · {humanizeStatus(lead.source)} ·{' '}
                      {formatDateTimeDisplay(lead.createdAt)}
                      {lead.followUpDueAt
                        ? ` · Due ${formatDateDisplay(lead.followUpDueAt.slice(0, 10))}`
                        : ''}
                    </p>
                    <h3 className="font-display text-base font-semibold text-[#083642]">
                      {lead.fullName} ·{' '}
                      <span className="font-mono-tabular font-normal text-sm">
                        {lead.phone}
                      </span>
                    </h3>
                    {lead.interestedService && (
                      <p className="text-xs text-[#0D4A5A]">
                        Interested in: {lead.interestedService}
                      </p>
                    )}
                    {lead.message && <p className="text-xs text-[#65747B]">{lead.message}</p>}
                    {lead.linkedAppointment && (
                      <p className="font-mono-tabular text-xs font-medium text-[#083642]">
                        Linked Appointment: {lead.linkedAppointment.bookingReference} ·{' '}
                        {formatDateDisplay(lead.linkedAppointment.appointmentDate)}{' '}
                        {lead.linkedAppointment.startTime} · {lead.linkedAppointment.service.name} ·{' '}
                        {humanizeStatus(lead.linkedAppointment.status)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={lead.status}
                      onChange={(e) => handleUpdateLead(lead.id, { status: e.target.value })}
                      className="h-9 w-48 text-xs"
                    >
                      <option value="NEW">New Inquiry</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="INFORMATION_PROVIDED">Information Provided</option>
                      <option value="APPOINTMENT_REQUESTED">Appointment Requested</option>
                      <option value="APPOINTMENT_CONFIRMED">Appointment Confirmed</option>
                      <option value="VISITED">Visited</option>
                      <option value="FOLLOW_UP">Follow-up Required</option>
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="CONVERTED">Converted</option>
                      <option value="CLOSED">Closed</option>
                    </Select>

                    <Select
                      value={lead.assignedTo?.id ?? ''}
                      onChange={(e) =>
                        handleUpdateLead(lead.id, {
                          assignedToId: e.target.value || null,
                        })
                      }
                      className="h-9 w-40 text-xs"
                    >
                      <option value="">Unassigned</option>
                      {assignees.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName}
                        </option>
                      ))}
                    </Select>

                    {lead.convertedPatient ? (
                      <span className="font-mono-tabular text-xs font-medium text-[#0D4A5A]">
                        Patient: {lead.convertedPatient.patientCode}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleConvert(lead.id)}
                      >
                        Convert to Patient
                      </Button>
                    )}
                  </div>
                </div>

                {/* Notes, Appointment Linking & Follow-Up Tasks */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 border-t border-[#E9F3F3] pt-3 text-xs">
                  <div className="space-y-2">
                    <p className="font-medium text-[#24343B]">Reception Notes</p>
                    <div className="flex gap-2">
                      <Input
                        value={noteInputs[lead.id] ?? lead.notes ?? ''}
                        onChange={(e) =>
                          setNoteInputs((prev) => ({
                            ...prev,
                            [lead.id]: e.target.value,
                          }))
                        }
                        placeholder="Add reception follow-up note..."
                        className="h-8 text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleUpdateLead(lead.id, {
                            notes: noteInputs[lead.id] ?? lead.notes ?? '',
                          })
                        }
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium text-[#24343B]">Link Appointment Reference</p>
                    <div className="flex gap-2">
                      <Input
                        value={linkRefInputs[lead.id] ?? ''}
                        onChange={(e) =>
                          setLinkRefInputs((prev) => ({
                            ...prev,
                            [lead.id]: e.target.value,
                          }))
                        }
                        placeholder="EDF-YYYYMMDD-XXXX"
                        className="h-8 text-xs font-mono-tabular"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleLinkAppointment(lead.id)}
                      >
                        Link
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium text-[#24343B]">Follow-Up Tasks</p>
                    <div className="flex gap-2">
                      <Input
                        value={taskInputs[lead.id] ?? ''}
                        onChange={(e) =>
                          setTaskInputs((prev) => ({
                            ...prev,
                            [lead.id]: e.target.value,
                          }))
                        }
                        placeholder="e.g., Call back at 4 PM"
                        className="h-8 text-xs"
                      />
                      <Input
                        type="date"
                        value={taskDueInputs[lead.id] ?? ''}
                        onChange={(e) =>
                          setTaskDueInputs((prev) => ({
                            ...prev,
                            [lead.id]: e.target.value,
                          }))
                        }
                        className="h-8 w-36 text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddTask(lead.id)}
                      >
                        Add
                      </Button>
                    </div>
                    {lead.tasks.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 text-xs text-[#24343B] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={t.isCompleted}
                          onChange={() => handleToggleTask(t.id)}
                        />
                        <span className={t.isCompleted ? 'line-through text-[#65747B]' : ''}>
                          {t.title}
                          {t.dueAt ? ` · Due ${formatDateDisplay(t.dueAt.slice(0, 10))}` : ''}
                          {t.assignedTo ? ` · ${t.assignedTo.fullName}` : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </StaffLayout>
  );
}
