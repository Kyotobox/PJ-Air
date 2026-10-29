import { addBusinessDays } from './date.utils';

describe('DateUtils - addBusinessDays (TASK-45-02)', () => {
  describe('Happy Path', () => {
    it('should add 3 business days starting on Friday and skip weekend to Wednesday', () => {
      // 2026-10-30 is Friday -> Sat 31 (skip), Sun 1 (skip), Mon 2 (1), Tue 3 (2), Wed 4 (3)
      const result = addBusinessDays('2026-10-30', 3);
      expect(result).toBe('2026-11-04');
    });

    it('should add 3 business days starting on Monday to Thursday', () => {
      // 2026-10-26 is Monday -> Tue 27 (1), Wed 28 (2), Thu 29 (3)
      const result = addBusinessDays('2026-10-26', 3);
      expect(result).toBe('2026-10-29');
    });

    it('should add 3 business days starting on Wednesday to Monday', () => {
      // 2026-10-28 is Wednesday -> Thu 29 (1), Fri 30 (2), Sat 31 (skip), Sun 1 (skip), Mon 2 (3)
      const result = addBusinessDays('2026-10-28', 3);
      expect(result).toBe('2026-11-02');
    });

    it('should accept a Date instance and return formatted ISO string YYYY-MM-DD', () => {
      const date = new Date(Date.UTC(2026, 9, 30)); // 2026-10-30
      const result = addBusinessDays(date, 3);
      expect(result).toBe('2026-11-04');
    });

    it('should default to 3 business days if days parameter is omitted', () => {
      const result = addBusinessDays('2026-10-30');
      expect(result).toBe('2026-11-04');
    });

    it('should return same date if 0 business days are added', () => {
      const result = addBusinessDays('2026-10-27', 0);
      expect(result).toBe('2026-10-27');
    });
  });

  describe('Sad Path (§6)', () => {
    it('should throw an error if startDate is null or undefined', () => {
      expect(() => addBusinessDays(null as any, 3)).toThrow(
        'Invalid startDate provided to addBusinessDays'
      );
      expect(() => addBusinessDays(undefined as any, 3)).toThrow(
        'Invalid startDate provided to addBusinessDays'
      );
    });

    it('should throw an error if days is negative', () => {
      expect(() => addBusinessDays('2026-10-30', -1)).toThrow(
        'Days must be a non-negative integer'
      );
    });

    it('should throw an error if days is not an integer or is NaN', () => {
      expect(() => addBusinessDays('2026-10-30', 2.5)).toThrow(
        'Days must be a non-negative integer'
      );
      expect(() => addBusinessDays('2026-10-30', NaN)).toThrow(
        'Days must be a non-negative integer'
      );
    });

    it('should throw an error for unparseable date strings', () => {
      expect(() => addBusinessDays('not-a-date', 3)).toThrow('Invalid date format');
    });
  });
});
