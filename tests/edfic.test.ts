import { describe, expect, it } from 'vitest';
import { scanMedicalContentCompliance } from '../src/server/services/compliance';
import { minutesToTime, timeToMinutes } from '../src/server/services/scheduling';
import { isValidPdfBuffer } from '../src/server/lib/storage';

describe('EDFIC Compliance Scanner', () => {
  it('approves factual clinical copy without pricing or prohibited claims', () => {
    const res = scanMedicalContentCompliance(
      'EWA Diagnostic and Fetal Imaging Centre provides specialist-led NT scans and anomaly scans by appointment in Lucknow.'
    );
    expect(res.passed).toBe(true);
    expect(res.issues).toHaveLength(0);
  });

  it('flags public pricing, discount, or PCPNDT sex determination violations', () => {
    const pricing = scanMedicalContentCompliance('Book Anomaly Scan for ₹1500 with 20% discount');
    expect(pricing.passed).toBe(false);
    expect(pricing.checks.noPricingOrDiscounts).toBe(false);

    const pcpndt = scanMedicalContentCompliance('Gender prediction and fetal sex determination available');
    expect(pcpndt.passed).toBe(false);
    expect(pcpndt.checks.noSexDetermination).toBe(false);
  });
});

describe('EDFIC Scheduling Utilities', () => {
  it('converts HH:MM time strings and minutes deterministically', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(minutesToTime(570)).toBe('09:30');
    expect(minutesToTime(timeToMinutes('13:30') + 30)).toBe('14:00');
  });
});

describe('EDFIC Private File Validation', () => {
  it('accepts valid PDF headers and rejects non-PDF payloads', () => {
    expect(isValidPdfBuffer(Buffer.from('%PDF-1.7\n...'))).toBe(true);
    expect(isValidPdfBuffer(Buffer.from('<script>alert(1)</script>'))).toBe(false);
  });
});
