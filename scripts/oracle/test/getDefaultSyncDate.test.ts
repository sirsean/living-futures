import { describe, it, expect } from '@jest/globals';
import { getDefaultSyncDate } from '../utils/dateUtils.js';

describe('getDefaultSyncDate', () => {
  describe('before cutoff hour (6AM ET default)', () => {
    it('returns yesterday at midnight ET', () => {
      // Create a test time representing midnight ET (5AM UTC during EST, 4AM UTC during EDT)
      const testTime = new Date('2025-05-20T04:00:00Z'); // Midnight ET in May (EDT)
      const result = getDefaultSyncDate(testTime);
      
      expect(result.date.toISOString().split('T')[0]).toBe('2025-05-19');
      expect(result.explanation).toContain('yesterday');
      expect(result.explanation).toContain('0:xx ET is before 6AM cutoff');
    });

    it('returns yesterday at 3AM ET', () => {
      const testTime = new Date('2025-05-20T07:00:00Z'); // 3AM ET in May (EDT)
      const result = getDefaultSyncDate(testTime);
      
      expect(result.date.toISOString().split('T')[0]).toBe('2025-05-19');
      expect(result.explanation).toContain('yesterday');
      expect(result.explanation).toContain('3:xx ET is before 6AM cutoff');
    });

    it('returns yesterday at 5AM ET', () => {
      const testTime = new Date('2025-05-20T09:00:00Z'); // 5AM ET in May (EDT)
      const result = getDefaultSyncDate(testTime);
      
      expect(result.date.toISOString().split('T')[0]).toBe('2025-05-19');
      expect(result.explanation).toContain('yesterday');
      expect(result.explanation).toContain('5:xx ET is before 6AM cutoff');
    });
  });

  describe('at or after cutoff hour (6AM ET default)', () => {
    it('returns today at 6AM ET', () => {
      const testTime = new Date('2025-05-20T10:00:00Z'); // 6AM ET in May (EDT)
      const result = getDefaultSyncDate(testTime);
      
      expect(result.date.toISOString().split('T')[0]).toBe('2025-05-20');
      expect(result.explanation).toContain('today');
      expect(result.explanation).toContain('6:xx ET is after 6AM cutoff');
    });

    it('returns today at 10AM ET', () => {
      const testTime = new Date('2025-05-20T14:00:00Z'); // 10AM ET in May (EDT)
      const result = getDefaultSyncDate(testTime);
      
      expect(result.date.toISOString().split('T')[0]).toBe('2025-05-20');
      expect(result.explanation).toContain('today');
      expect(result.explanation).toContain('10:xx ET is after 6AM cutoff');
    });

    it('returns today at 11PM ET', () => {
      const testTime = new Date('2025-05-21T03:00:00Z'); // 11PM ET on May 20 (EDT)
      const result = getDefaultSyncDate(testTime);
      
      expect(result.date.toISOString().split('T')[0]).toBe('2025-05-20');
      expect(result.explanation).toContain('today');
      expect(result.explanation).toContain('23:xx ET is after 6AM cutoff');
    });
  });

  describe('custom cutoff hours', () => {
    it('respects custom cutoff hour of 8AM', () => {
      const testTime = new Date('2025-05-20T11:00:00Z'); // 7AM ET in May (EDT)
      const result = getDefaultSyncDate(testTime, 8);
      
      expect(result.date.toISOString().split('T')[0]).toBe('2025-05-19');
      expect(result.explanation).toContain('yesterday');
      expect(result.explanation).toContain('7:xx ET is before 8AM cutoff');
    });

    it('respects custom cutoff hour of 4AM', () => {
      const testTime = new Date('2025-05-20T09:00:00Z'); // 5AM ET in May (EDT)
      const result = getDefaultSyncDate(testTime, 4);
      
      expect(result.date.toISOString().split('T')[0]).toBe('2025-05-20');
      expect(result.explanation).toContain('today');
      expect(result.explanation).toContain('5:xx ET is after 4AM cutoff');
    });
  });

  describe('DST handling', () => {
    it('works correctly during EST (winter)', () => {
      // January test - EST is UTC-5
      const testTime = new Date('2025-01-15T10:00:00Z'); // 5AM EST
      const result = getDefaultSyncDate(testTime);
      
      expect(result.date.toISOString().split('T')[0]).toBe('2025-01-14');
      expect(result.explanation).toContain('yesterday');
      expect(result.explanation).toContain('5:xx ET is before 6AM cutoff');
    });

    it('works correctly during EDT (summer)', () => {
      // July test - EDT is UTC-4
      const testTime = new Date('2025-07-15T10:00:00Z'); // 6AM EDT
      const result = getDefaultSyncDate(testTime);
      
      expect(result.date.toISOString().split('T')[0]).toBe('2025-07-15');
      expect(result.explanation).toContain('today');
      expect(result.explanation).toContain('6:xx ET is after 6AM cutoff');
    });
  });

  describe('edge cases', () => {
    it('uses current time when no time provided', () => {
      const result = getDefaultSyncDate();
      
      // Should return a valid date
      expect(result.date).toBeInstanceOf(Date);
      expect(result.explanation).toMatch(/today|yesterday/);
    });

    it('handles year boundaries correctly', () => {
      // New Year's Day at 3AM ET
      const testTime = new Date('2025-01-01T08:00:00Z'); // 3AM EST (UTC-5)
      const result = getDefaultSyncDate(testTime);
      
      expect(result.date.toISOString().split('T')[0]).toBe('2024-12-31');
      expect(result.explanation).toContain('yesterday');
    });
  });
});