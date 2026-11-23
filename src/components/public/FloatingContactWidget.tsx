import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  MessageSquareText,
  Phone,
  Send,
  UserCheck,
  X,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { PublicClinicInfo, usePublicServices } from '../../hooks/usePublicClinic';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  suggestedRoute?: { label: string; to: string };
  promptReceptionHandoff?: boolean;
  leadCode?: string;
}

const QUICK_PROMPTS = [
  'Timings & Sushant Golf City location',
  'How to book an ultrasound slot',
  'Scan preparation & fasting rules',
  'How to download Patient Portal report',
];

function sanitizePhoneDigits(raw?: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function FloatingContactWidget({ clinic }: { clinic?: PublicClinicInfo }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [showReceptionForm, setShowReceptionForm] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Reception handoff form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [interestedService, setInterestedService] = useState('');
  const [handoffNote, setHandoffNote] = useState('');
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Welcome to EDFIC Reception Assistant. Ask about ultrasound timings, preparation, booking steps, Patient Portal reports, or send a query directly to our reception desk.',
    },
  ]);

  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const { data: servicesData } = usePublicServices();
  const allServices = servicesData?.categories.flatMap((c) => c.services) ?? [];

  useEffect(() => {
    if (chatOpen && messagesScrollRef.current) {
      const el = messagesScrollRef.current;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, showReceptionForm, chatOpen]);

  const rawPhone = clinic?.primaryPhone?.trim() || '';
  const rawWhatsapp = clinic?.whatsappNumber?.trim() || rawPhone;
  const waDigits = sanitizePhoneDigits(rawWhatsapp);
  const telHref = rawPhone ? `tel:${rawPhone.replace(/[^+\d]/g, '')}` : '';
  const waHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
        'Hello EDFIC Reception, I would like to inquire about a diagnostic ultrasound or fetal imaging appointment.'
      )}`
    : '';

  const sendQuestion = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);

    try {
      const res = await apiFetch<{
        reply: string;
        suggestedRoute?: { label: string; to: string };
        promptReceptionHandoff?: boolean;
      }>('/api/v1/public/chat', {
        method: 'POST',
        body: JSON.stringify({ action: 'ASK', message: trimmed }),
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: res.reply,
          suggestedRoute: res.suggestedRoute,
          promptReceptionHandoff: res.promptReceptionHandoff,
        },
      ]);
      if (res.promptReceptionHandoff && !handoffNote) {
        setHandoffNote(trimmed);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'bot',
          text: 'Could not reach automated lookup right now. You can send your query directly to our Reception Desk below.',
          promptReceptionHandoff: true,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmitToReception = async (e: React.FormEvent) => {
    e.preventDefault();
    setHandoffError(null);
    if (fullName.trim().length < 2) {
      setHandoffError('Please enter your full name.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setHandoffError('Enter a valid 10-digit mobile number.');
      return;
    }

    const queryBody =
      handoffNote.trim() ||
      messages
        .filter((m) => m.sender === 'user')
        .map((m) => m.text)
        .slice(-2)
        .join(' | ') ||
      'Callback requested via Reception Chatbot';

    setIsSubmittingLead(true);
    try {
      const res = await apiFetch<{
        leadCode: string;
        reply: string;
        suggestedRoute?: { label: string; to: string };
      }>('/api/v1/public/chat', {
        method: 'POST',
        body: JSON.stringify({
          action: 'SUBMIT_TO_RECEPTION',
          fullName: fullName.trim(),
          phone: phone.trim(),
          interestedService: interestedService || undefined,
          message: queryBody,
        }),
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `lead-${Date.now()}`,
          sender: 'bot',
          text: res.reply,
          leadCode: res.leadCode,
          suggestedRoute: res.suggestedRoute,
        },
      ]);
      setShowReceptionForm(false);
      setFullName('');
      setPhone('');
      setInterestedService('');
      setHandoffNote('');
    } catch (err: unknown) {
      setHandoffError(err instanceof Error ? err.message : 'Could not forward query to reception.');
    } finally {
      setIsSubmittingLead(false);
    }
  };

  const openChatWithNotice = (notice: string) => {
    setChatOpen(true);
    setShowReceptionForm(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `notice-${Date.now()}`,
        sender: 'bot',
        text: notice,
      },
    ]);
  };

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 sm:bottom-5 sm:right-6 z-[60] flex max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-[calc(100vw-3rem)] flex-col items-end gap-2.5 sm:gap-3">
      {/* Automated Reception Chatbot Panel */}
      {chatOpen && (
        <div
          role="dialog"
          aria-label="EDFIC Automated Reception Chatbot"
          className="edfic-tab-fade pointer-events-auto flex w-[min(calc(100vw-1.5rem),390px)] max-h-[min(560px,calc(100dvh-5.5rem))] sm:max-h-[min(560px,calc(100dvh-6.5rem))] flex-col overflow-hidden rounded-3xl border border-[#DCE7E9] bg-white shadow-[0_24px_64px_-16px_rgba(13,74,90,0.28)]"
        >
          {/* Header */}
          <div className="shrink-0 bg-gradient-to-r from-[#083642] via-[#0D4A5A] to-[#287887] px-4 py-3.5 sm:px-5 sm:py-4 text-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-sm font-bold truncate">
                  EDFIC Reception Assistant
                </p>
                <p className="text-[11px] text-[#A5E4EB] truncate">
                  Automated Desk · Linked to Reception CRM
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              aria-label="Close reception chat"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Stream */}
          <div
            ref={messagesScrollRef}
            className="min-h-0 flex-initial overflow-y-auto overscroll-contain bg-[#F8FCFD] p-3.5 sm:p-4 space-y-3"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[#0D4A5A] text-white rounded-br-sm'
                      : 'bg-white border border-[#DCE7E9] text-[#24343B] rounded-bl-sm shadow-xs'
                  }`}
                >
                  {msg.leadCode && (
                    <p className="mb-1 inline-flex items-center gap-1 font-mono-tabular text-[11px] font-semibold text-[#15803D]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>CRM Ref: {msg.leadCode}</span>
                    </p>
                  )}
                  <p>{msg.text}</p>
                </div>

                {msg.sender === 'bot' && (msg.suggestedRoute || msg.promptReceptionHandoff) && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {msg.suggestedRoute && (
                      <Link
                        to={msg.suggestedRoute.to}
                        onClick={() => setChatOpen(false)}
                        className="inline-flex items-center gap-1 rounded-full border border-[#287887]/40 bg-white px-3 py-1 text-[11px] font-semibold text-[#0D4A5A] hover:bg-[#E9F3F3]"
                      >
                        <span>{msg.suggestedRoute.label}</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                    {msg.promptReceptionHandoff && !showReceptionForm && (
                      <button
                        type="button"
                        onClick={() => setShowReceptionForm(true)}
                        className="inline-flex items-center gap-1 rounded-full bg-[#0D4A5A] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#083642] cursor-pointer"
                      >
                        <UserCheck className="h-3 w-3" />
                        <span>Send Query to Reception</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Quick Prompt Chips */}
            {messages.length <= 2 && !showReceptionForm && (
              <div className="pt-1 flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendQuestion(prompt)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#C9E2E8] bg-white px-2.5 py-1 text-[11px] font-medium text-[#083642] transition-colors hover:border-[#0D4A5A] hover:bg-[#E9F3F3] cursor-pointer"
                  >
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Live CRM Reception Ticket Form */}
            {showReceptionForm && (
              <form
                onSubmit={handleSubmitToReception}
                className="rounded-2xl border border-[#B9D3DA] bg-white p-3.5 space-y-2.5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[#083642]">
                    Forward Query to Reception CRM
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowReceptionForm(false)}
                    className="text-[11px] text-[#65747B] hover:text-[#083642] cursor-pointer"
                  >
                    Hide
                  </button>
                </div>

                {handoffError && (
                  <p className="rounded-lg bg-[#FEF3F2] px-2.5 py-1.5 text-[11px] text-[#B42318]">
                    {handoffError}
                  </p>
                )}

                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name *"
                  className="w-full rounded-lg border border-[#DCE7E9] px-3 py-1.5 text-xs text-[#24343B] focus:border-[#0D4A5A] focus:outline-none"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number *"
                  className="w-full rounded-lg border border-[#DCE7E9] px-3 py-1.5 text-xs text-[#24343B] focus:border-[#0D4A5A] focus:outline-none"
                />
                <select
                  value={interestedService}
                  onChange={(e) => setInterestedService(e.target.value)}
                  className="w-full rounded-lg border border-[#DCE7E9] bg-white px-2.5 py-1.5 text-xs text-[#24343B] focus:border-[#0D4A5A] focus:outline-none"
                >
                  <option value="">Select investigation (optional)</option>
                  {allServices.map((svc) => (
                    <option key={svc.id} value={svc.name}>
                      {svc.name}
                    </option>
                  ))}
                </select>
                <textarea
                  rows={2}
                  value={handoffNote}
                  onChange={(e) => setHandoffNote(e.target.value)}
                  placeholder="Your question or preferred slot window *"
                  className="w-full rounded-lg border border-[#DCE7E9] px-3 py-1.5 text-xs text-[#24343B] focus:border-[#0D4A5A] focus:outline-none resize-none"
                />
                <button
                  type="submit"
                  disabled={isSubmittingLead}
                  className="w-full rounded-full bg-[#0D4A5A] py-2 text-xs font-semibold text-white transition-colors hover:bg-[#083642] disabled:opacity-60 cursor-pointer"
                >
                  {isSubmittingLead ? 'Sending to Reception...' : 'Submit to Reception Desk'}
                </button>
              </form>
            )}

          </div>

          {/* Chat Composer Footer */}
          <div className="shrink-0 border-t border-[#DCE7E9] bg-white p-3 space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendQuestion(inputText);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask about timings, scans, prep, EDF-ref..."
                className="min-w-0 flex-1 rounded-full border border-[#DCE7E9] bg-[#F8FAFA] px-3.5 py-2 text-xs text-[#24343B] focus:border-[#0D4A5A] focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSending || !inputText.trim()}
                aria-label="Send chat message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0D4A5A] text-white transition-colors hover:bg-[#083642] disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            {!showReceptionForm && (
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-1 text-[11px] text-[#65747B]">
                <span>Need direct callback?</span>
                <button
                  type="button"
                  onClick={() => setShowReceptionForm(true)}
                  className="font-semibold text-[#0D4A5A] hover:underline cursor-pointer"
                >
                  Connect to Reception CRM →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compact Circular Contact CTAs Stack: WhatsApp · Call · Reception Chat */}
      <div
        className={`pointer-events-auto flex shrink-0 items-end gap-2.5 ${
          chatOpen ? 'flex-row items-center' : 'flex-col'
        }`}
      >
        {/* 1. Circular WhatsApp CTA */}
        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp EDFIC Reception"
            title="WhatsApp EDFIC"
            className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-[#15803D] text-white shadow-[0_10px_24px_-6px_rgba(21,128,61,0.55)] transition-all duration-300 hover:scale-110 hover:bg-[#166534]"
          >
            <span
              className={`pointer-events-none absolute right-14 whitespace-nowrap rounded-full bg-[#083642] px-3 py-1 text-[11px] font-semibold text-white opacity-0 shadow-md transition-opacity duration-200 ${
                chatOpen ? 'hidden' : 'group-hover:opacity-100'
              }`}
            >
              WhatsApp
            </span>
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.79 14.08c-.24.67-1.42 1.28-1.95 1.36-.52.08-1.18.11-1.91-.12-.44-.14-1-.33-1.72-.64-3.03-1.31-5.01-4.37-5.16-4.57-.15-.2-1.23-1.64-1.23-3.13 0-1.49.78-2.22 1.06-2.52.28-.3.61-.38.81-.38.2 0 .41.01.59.01.19 0 .44-.07.69.53.25.61.85 2.11.93 2.26.08.15.13.33.03.53-.1.2-.15.33-.3.5-.15.17-.32.39-.45.52-.15.15-.31.31-.13.61.18.3.79 1.3 1.7 2.11 1.17 1.04 2.15 1.37 2.45 1.52.3.15.48.13.66-.08.18-.21.76-.89.96-1.19.2-.3.41-.25.68-.15.28.1 1.76.83 2.06.98.3.15.5.23.57.36.08.13.08.76-.16 1.43z" />
            </svg>
          </a>
        ) : (
          <button
            type="button"
            onClick={() =>
              openChatWithNotice(
                'WhatsApp reception contact is configurable in Admin Settings. You can log your query directly with EDFIC Reception below and receive WhatsApp acknowledgment automatically.'
              )
            }
            aria-label="WhatsApp query via EDFIC Reception"
            title="WhatsApp EDFIC"
            className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-[#15803D] text-white shadow-[0_10px_24px_-6px_rgba(21,128,61,0.55)] transition-all duration-300 hover:scale-110 hover:bg-[#166534] cursor-pointer"
          >
            <span
              className={`pointer-events-none absolute right-14 whitespace-nowrap rounded-full bg-[#083642] px-3 py-1 text-[11px] font-semibold text-white opacity-0 shadow-md transition-opacity duration-200 ${
                chatOpen ? 'hidden' : 'group-hover:opacity-100'
              }`}
            >
              WhatsApp
            </span>
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.79 14.08c-.24.67-1.42 1.28-1.95 1.36-.52.08-1.18.11-1.91-.12-.44-.14-1-.33-1.72-.64-3.03-1.31-5.01-4.37-5.16-4.57-.15-.2-1.23-1.64-1.23-3.13 0-1.49.78-2.22 1.06-2.52.28-.3.61-.38.81-.38.2 0 .41.01.59.01.19 0 .44-.07.69.53.25.61.85 2.11.93 2.26.08.15.13.33.03.53-.1.2-.15.33-.3.5-.15.17-.32.39-.45.52-.15.15-.31.31-.13.61.18.3.79 1.3 1.7 2.11 1.17 1.04 2.15 1.37 2.45 1.52.3.15.48.13.66-.08.18-.21.76-.89.96-1.19.2-.3.41-.25.68-.15.28.1 1.76.83 2.06.98.3.15.5.23.57.36.08.13.08.76-.16 1.43z" />
            </svg>
          </button>
        )}

        {/* 2. Circular Call CTA */}
        {telHref ? (
          <a
            href={telHref}
            aria-label="Call EDFIC Reception"
            title="Call EDFIC"
            className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-[#287887] text-white shadow-[0_10px_24px_-6px_rgba(40,120,135,0.5)] transition-all duration-300 hover:scale-110 hover:bg-[#083642]"
          >
            <span
              className={`pointer-events-none absolute right-14 whitespace-nowrap rounded-full bg-[#083642] px-3 py-1 text-[11px] font-semibold text-white opacity-0 shadow-md transition-opacity duration-200 ${
                chatOpen ? 'hidden' : 'group-hover:opacity-100'
              }`}
            >
              Call Desk
            </span>
            <Phone className="h-5 w-5" />
          </a>
        ) : (
          <button
            type="button"
            onClick={() =>
              openChatWithNotice(
                `Official reception phone number can be set in EDFIC Admin Settings. Centre Hours: ${
                  clinic?.weekdayHours || 'Mon–Sat 9:00 AM – 8:00 PM'
                }. Request a callback directly below.`
              )
            }
            aria-label="Request Call from EDFIC Reception"
            title="Call EDFIC"
            className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-[#287887] text-white shadow-[0_10px_24px_-6px_rgba(40,120,135,0.5)] transition-all duration-300 hover:scale-110 hover:bg-[#083642] cursor-pointer"
          >
            <span
              className={`pointer-events-none absolute right-14 whitespace-nowrap rounded-full bg-[#083642] px-3 py-1 text-[11px] font-semibold text-white opacity-0 shadow-md transition-opacity duration-200 ${
                chatOpen ? 'hidden' : 'group-hover:opacity-100'
              }`}
            >
              Call Desk
            </span>
            <Phone className="h-5 w-5" />
          </button>
        )}

        {/* 3. Circular Automated Reception Chatbot CTA */}
        <button
          type="button"
          onClick={() => setChatOpen((prev) => !prev)}
          aria-expanded={chatOpen}
          aria-label="Toggle EDFIC Automated Reception Chat"
          title="Reception Chat"
          className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#287887] to-[#0D4A5A] text-white shadow-[0_12px_28px_-6px_rgba(13,74,90,0.58)] transition-all duration-300 hover:scale-110 hover:from-[#0D4A5A] hover:to-[#083642] cursor-pointer"
        >
          <span
            className={`pointer-events-none absolute right-14 whitespace-nowrap rounded-full bg-[#083642] px-3 py-1 text-[11px] font-semibold text-white opacity-0 shadow-md transition-opacity duration-200 ${
              chatOpen ? 'hidden' : 'group-hover:opacity-100'
            }`}
          >
            {chatOpen ? 'Close Chat' : 'Reception Chat'}
          </span>
          {chatOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <MessageSquareText className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}
