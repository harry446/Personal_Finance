import { describe, expect, it } from 'vitest';

import {
  createDefaultCategoryData,
  DEFAULT_CATEGORY_NAMES,
  normalizeCategoryName,
  resolveCategoryCreate,
} from '@/lib/categories';

describe('default category bootstrap data', () => {
  it('normalizes names with trimming and case-insensitive matching', () => {
    expect(normalizeCategoryName('  COFFEE and Snacks  ')).toBe(
      'coffee and snacks',
    );
    expect(() => normalizeCategoryName('   ')).toThrow();
  });

  it('resolves category creation against absent, active, and archived matches', () => {
    expect(resolveCategoryCreate(null)).toBe('create');
    expect(resolveCategoryCreate({ archivedAt: null })).toBe('conflict');
    expect(
      resolveCategoryCreate({ archivedAt: new Date('2026-08-31T00:00:00Z') }),
    ).toBe('reactivate');
  });

  it('contains one normalized active default for each suggested category', () => {
    const categoryData = createDefaultCategoryData('user-1');

    expect(categoryData).toHaveLength(DEFAULT_CATEGORY_NAMES.length);
    expect(
      new Set(categoryData.map((category) => category.normalizedName)).size,
    ).toBe(DEFAULT_CATEGORY_NAMES.length);
    expect(categoryData).toContainEqual({
      userId: 'user-1',
      name: 'Groceries',
      normalizedName: 'groceries',
    });
  });
});
