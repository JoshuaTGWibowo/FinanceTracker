/**
 * Category Matcher Utility
 * 
 * Fuzzy matches AI-suggested categories to the user's existing categories.
 * Falls back to closest match or "Other" if no good match is found.
 */

import type { Category } from './types';

/**
 * Calculate similarity between two strings using Levenshtein distance
 * Returns a score between 0 (completely different) and 1 (identical)
 */
const stringSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8;
  }
  
  // Levenshtein distance
  const matrix: number[][] = [];
  
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - matrix[s1.length][s2.length] / maxLen;
};

/**
 * Common category aliases/synonyms for better matching
 */
const CATEGORY_ALIASES: Record<string, string[]> = {
  'Food': ['food', 'meal', 'meals', 'eating', 'restaurant', 'cafe'],
  'Groceries': ['groceries', 'grocery', 'supermarket', 'market', 'walmart', 'costco', 'target', 'aldi', 'kroger', 'safeway', 'trader joe'],
  'Dining': ['dining', 'restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonalds', 'fast food', 'takeout', 'takeaway', 'delivery'],
  'Transport': ['transport', 'transportation', 'uber', 'lyft', 'taxi', 'bus', 'train', 'metro', 'subway', 'gas', 'fuel', 'petrol', 'parking'],
  'Travel': ['travel', 'flight', 'hotel', 'airbnb', 'vacation', 'trip', 'airline', 'booking'],
  'Entertainment': ['entertainment', 'movies', 'cinema', 'netflix', 'spotify', 'streaming', 'games', 'gaming', 'concert', 'show'],
  'Health': ['health', 'medical', 'doctor', 'pharmacy', 'medicine', 'hospital', 'clinic', 'dental', 'dentist', 'healthcare'],
  'Fitness': ['fitness', 'gym', 'workout', 'sports', 'exercise', 'yoga', 'running'],
  'Bills': ['bills', 'bill', 'utility', 'utilities', 'electric', 'electricity', 'water', 'internet', 'phone', 'mobile', 'subscription'],
  'Utilities': ['utilities', 'utility', 'electric', 'electricity', 'water', 'gas', 'heating', 'cooling'],
  'Rent': ['rent', 'mortgage', 'housing', 'lease'],
  'Home': ['home', 'house', 'household', 'furniture', 'appliances', 'cleaning', 'maintenance'],
  'Education': ['education', 'school', 'university', 'college', 'course', 'learning', 'books', 'tuition'],
  'Work Expenses': ['work', 'office', 'business', 'professional', 'supplies'],
  'Pets': ['pets', 'pet', 'dog', 'cat', 'vet', 'veterinary', 'animal'],
  'Family': ['family', 'kids', 'children', 'childcare', 'baby'],
  'Gear': ['gear', 'equipment', 'electronics', 'tech', 'gadgets', 'amazon'],
  'Creativity': ['creativity', 'art', 'craft', 'hobby', 'creative'],
  'Outdoors': ['outdoors', 'outdoor', 'camping', 'hiking', 'nature'],
  'Lifestyle': ['lifestyle', 'personal', 'shopping', 'clothing', 'clothes', 'fashion', 'beauty', 'hair', 'salon'],
  'Salary': ['salary', 'paycheck', 'wages', 'pay', 'income'],
  'Side Hustle': ['side hustle', 'freelance', 'gig', 'extra income'],
  'Client Work': ['client', 'client work', 'project', 'contract'],
  'Consulting': ['consulting', 'consultant', 'advisory'],
  'Investing': ['investing', 'investment', 'stocks', 'crypto', 'trading'],
  'Bonus': ['bonus', 'reward', 'incentive'],
  'Dividends': ['dividends', 'dividend', 'yield', 'interest'],
  'Other': ['other', 'misc', 'miscellaneous', 'general', 'uncategorized'],
};

/**
 * Find the best matching category from user's categories
 * @param suggestedCategory - Category name suggested by AI
 * @param userCategories - User's available categories
 * @param transactionType - 'expense' or 'income' to filter category types
 * @returns The matched category name, or the first available category as fallback
 */
export const matchCategory = (
  suggestedCategory: string,
  userCategories: Category[],
  transactionType: 'expense' | 'income' = 'expense'
): string => {
  if (!suggestedCategory || userCategories.length === 0) {
    // Fallback to first category of the right type
    const fallback = userCategories.find(c => 
      c.type === transactionType || c.type === 'expense'
    );
    return fallback?.name || 'Other';
  }

  const normalizedSuggestion = suggestedCategory.toLowerCase().trim();
  
  // Filter categories by type (expense categories for expenses, income for income)
  const relevantCategories = userCategories.filter(c => 
    c.type === transactionType || 
    (transactionType === 'expense' && c.type === 'expense') ||
    (transactionType === 'income' && c.type === 'income')
  );

  // If no relevant categories, use all
  const categoriesToSearch = relevantCategories.length > 0 ? relevantCategories : userCategories;

  // First, try exact match (case-insensitive)
  const exactMatch = categoriesToSearch.find(
    c => c.name.toLowerCase() === normalizedSuggestion
  );
  if (exactMatch) return exactMatch.name;

  // Try alias matching
  for (const category of categoriesToSearch) {
    const categoryName = category.name.toLowerCase();
    const aliases = CATEGORY_ALIASES[category.name] || [];
    
    // Check if suggestion matches any alias
    if (aliases.some(alias => 
      normalizedSuggestion.includes(alias) || alias.includes(normalizedSuggestion)
    )) {
      return category.name;
    }
    
    // Check reverse - if any alias is in the suggestion
    for (const [key, aliasList] of Object.entries(CATEGORY_ALIASES)) {
      if (aliasList.some(alias => normalizedSuggestion.includes(alias))) {
        const matchedCategory = categoriesToSearch.find(
          c => c.name.toLowerCase() === key.toLowerCase()
        );
        if (matchedCategory) return matchedCategory.name;
      }
    }
  }

  // Fuzzy match - find best similarity score
  let bestMatch: Category | null = null;
  let bestScore = 0;
  const MINIMUM_SIMILARITY = 0.4;

  for (const category of categoriesToSearch) {
    const score = stringSimilarity(normalizedSuggestion, category.name);
    if (score > bestScore && score >= MINIMUM_SIMILARITY) {
      bestScore = score;
      bestMatch = category;
    }
  }

  if (bestMatch) return bestMatch.name;

  // Last resort: return first expense/income category or "Other"
  const defaultCategory = categoriesToSearch.find(c => 
    c.name.toLowerCase() !== 'other'
  ) || categoriesToSearch[0];
  
  return defaultCategory?.name || 'Other';
};

/**
 * Batch match categories for multiple transactions
 */
export const matchCategoriesForTransactions = <T extends { suggestedCategory: string; type: 'expense' | 'income' }>(
  transactions: T[],
  userCategories: Category[]
): (T & { matchedCategory: string })[] => {
  return transactions.map(t => ({
    ...t,
    matchedCategory: matchCategory(t.suggestedCategory, userCategories, t.type),
  }));
};
