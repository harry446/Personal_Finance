import { z } from 'zod';

export const DEFAULT_CATEGORY_NAMES = [
  'Groceries',
  'Restaurants',
  'Coffee and snacks',
  'Transportation',
  'Gas',
  'Shopping',
  'Entertainment',
  'Subscriptions',
  'Health',
  'Fitness',
  'Personal care',
  'Home',
  'Utilities',
  'Travel',
  'Gifts',
  'Education',
  'Fees',
  'Other',
] as const;

const categoryNameSchema = z.string().trim().min(1).max(80);

export function normalizeCategoryName(value: string) {
  return categoryNameSchema.parse(value).toLocaleLowerCase('en-CA');
}

export function createDefaultCategoryData(userId: string) {
  return DEFAULT_CATEGORY_NAMES.map((name) => ({
    userId,
    name,
    normalizedName: normalizeCategoryName(name),
  }));
}
