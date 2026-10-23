import { describe, it, expect } from 'vitest';
import { calculatePagination } from '../src/utils/pagination';
import { slugify } from '../src/utils/slugify';

describe('Shared Utilities', () => {
  describe('calculatePagination', () => {
    it('should compute default pagination when parameters are empty', () => {
      const result = calculatePagination({}, 50, 20);

      expect(result).toEqual({
        page: 1,
        limit: 20,
        skip: 0,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: false,
      });
    });

    it('should calculate offset correctly for page 2', () => {
      const result = calculatePagination({ page: 2, limit: 15 }, 40);

      expect(result).toEqual({
        page: 2,
        limit: 15,
        skip: 15,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      });
    });

    it('should cap limit at maximum allowed limit', () => {
      const result = calculatePagination({ page: 1, limit: 500 }, 50, 20, 100);

      expect(result.limit).toBe(100);
    });

    it('should gracefully handle 0 total items', () => {
      const result = calculatePagination({ page: 1, limit: 10 }, 0);

      expect(result.totalPages).toBe(0);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPrevPage).toBe(false);
    });
  });

  describe('slugify', () => {
    it('should convert standard titles into URL-safe slugs', () => {
      expect(slugify('Introduction to React & TypeScript!')).toBe('introduction-to-react-typescript');
      expect(slugify('  Course 101: Advanced NestJS & Prisma  ')).toBe('course-101-advanced-nestjs-prisma');
      expect(slugify('Multiple---Dashes___and Spaces')).toBe('multiple-dashes-and-spaces');
    });
  });
});
