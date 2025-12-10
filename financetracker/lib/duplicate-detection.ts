/**
 * Duplicate Transaction Detection Utility
 * 
 * Compares extracted transactions against existing transactions to identify
 * potential duplicates and warn users before saving.
 */

import dayjs from 'dayjs';
import type { Transaction } from './types';
import type { ExtractedTransaction } from './ai-receipt-parser';

export interface DuplicateMatch {
  extractedId: string;
  existingTransaction: Transaction;
  confidence: number; // 0-1 score
  reasons: string[];
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  matches: DuplicateMatch[];
}

/**
 * Calculate string similarity for notes comparison
 */
const noteSimilarity = (note1: string, note2: string): number => {
  const s1 = note1.toLowerCase().trim();
  const s2 = note2.toLowerCase().trim();
  
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  
  // Check word overlap
  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let commonWords = 0;
  for (const word of words1) {
    if (words2.has(word)) commonWords++;
  }
  
  return commonWords / Math.max(words1.size, words2.size);
};

/**
 * Check if an extracted transaction might be a duplicate of an existing one
 */
const checkSingleDuplicate = (
  extracted: ExtractedTransaction,
  existing: Transaction
): DuplicateMatch | null => {
  const reasons: string[] = [];
  let score = 0;

  // 1. Amount match (exact or very close) - High importance
  const amountDiff = Math.abs(extracted.amount - existing.amount);
  const amountMatch = amountDiff < 0.01; // Exact match
  const amountClose = amountDiff / Math.max(extracted.amount, existing.amount) < 0.05; // Within 5%
  
  if (amountMatch) {
    score += 0.4;
    reasons.push('Exact amount match');
  } else if (amountClose) {
    score += 0.2;
    reasons.push('Similar amount');
  }

  // 2. Date match - High importance
  const extractedDate = dayjs(extracted.date).startOf('day');
  const existingDate = dayjs(existing.date).startOf('day');
  const daysDiff = Math.abs(extractedDate.diff(existingDate, 'day'));

  if (daysDiff === 0) {
    score += 0.35;
    reasons.push('Same date');
  } else if (daysDiff <= 1) {
    score += 0.2;
    reasons.push('Adjacent date (±1 day)');
  } else if (daysDiff <= 3) {
    score += 0.1;
    reasons.push('Close date (±3 days)');
  }

  // 3. Note/description similarity - Medium importance
  const noteSim = noteSimilarity(extracted.note, existing.note);
  if (noteSim > 0.7) {
    score += 0.25;
    reasons.push('Similar description');
  } else if (noteSim > 0.4) {
    score += 0.1;
    reasons.push('Some description overlap');
  }

  // 4. Category match - Low importance (bonus)
  if (extracted.suggestedCategory.toLowerCase() === existing.category.toLowerCase()) {
    score += 0.1;
    reasons.push('Same category');
  }

  // 5. Transaction type match - Required
  if (extracted.type !== existing.type) {
    // Different type, unlikely to be duplicate
    return null;
  }

  // Threshold for considering a duplicate
  const DUPLICATE_THRESHOLD = 0.5;
  
  if (score >= DUPLICATE_THRESHOLD && reasons.length >= 2) {
    return {
      extractedId: extracted.id,
      existingTransaction: existing,
      confidence: Math.min(1, score),
      reasons,
    };
  }

  return null;
};

/**
 * Check extracted transactions for potential duplicates
 * @param extracted - Transactions extracted from image
 * @param existing - User's existing transactions
 * @param lookbackDays - How many days back to check for duplicates (default 30)
 * @returns Duplicate check results with matches
 */
export const checkForDuplicates = (
  extracted: ExtractedTransaction[],
  existing: Transaction[],
  lookbackDays: number = 30
): DuplicateCheckResult => {
  const matches: DuplicateMatch[] = [];
  
  // Filter existing transactions to recent ones for performance
  const cutoffDate = dayjs().subtract(lookbackDays, 'day');
  const recentExisting = existing.filter(t => 
    dayjs(t.date).isAfter(cutoffDate)
  );

  for (const ext of extracted) {
    // Find the best matching duplicate for this extracted transaction
    let bestMatch: DuplicateMatch | null = null;
    
    for (const existingTx of recentExisting) {
      const match = checkSingleDuplicate(ext, existingTx);
      
      if (match && (!bestMatch || match.confidence > bestMatch.confidence)) {
        bestMatch = match;
      }
    }
    
    if (bestMatch) {
      matches.push(bestMatch);
    }
  }

  return {
    hasDuplicates: matches.length > 0,
    matches,
  };
};

/**
 * Get duplicate warning message for a transaction
 */
export const getDuplicateWarningMessage = (match: DuplicateMatch): string => {
  const date = dayjs(match.existingTransaction.date).format('MMM D');
  const amount = match.existingTransaction.amount.toFixed(2);
  const confidence = Math.round(match.confidence * 100);
  
  return `Possible duplicate (${confidence}% match): ${match.existingTransaction.note} - $${amount} on ${date}`;
};

/**
 * Check if a specific extracted transaction has a duplicate
 */
export const getTransactionDuplicate = (
  extractedId: string,
  duplicateResult: DuplicateCheckResult
): DuplicateMatch | undefined => {
  return duplicateResult.matches.find(m => m.extractedId === extractedId);
};
