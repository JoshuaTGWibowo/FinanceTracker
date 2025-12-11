/**
 * AI Receipt Parser Service
 * 
 * Uses Google Gemini Vision API to extract transaction data from receipt/statement images.
 * Designed with an abstraction layer so the AI provider can be swapped in the future.
 * 
 * TODO: For production, move the API key to a backend proxy (e.g., Supabase Edge Function)
 * to avoid exposing it in the client bundle. The current implementation uses environment
 * variables which are bundled into the app.
 */

import Constants from 'expo-constants';

// Types for extracted transaction data
export interface ExtractedTransaction {
  id: string;
  amount: number;
  note: string;
  type: 'income' | 'expense';
  suggestedCategory: string;
  date: string;
  confidence: number; // 0-1 score indicating extraction confidence
  location?: string;
}

export interface AIParseResult {
  success: boolean;
  transactions: ExtractedTransaction[];
  error?: string;
  rawResponse?: string;
}

// Abstract interface for AI providers - allows swapping providers in the future
export interface AIReceiptParser {
  parseImage(base64Image: string, mimeType: string): Promise<AIParseResult>;
}

/**
 * Google Gemini Vision Parser Implementation
 * Uses the gemini-2.0-flash model (free tier available)
 */
class GeminiReceiptParser implements AIReceiptParser {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    // TODO: Move to backend proxy for production security
    // Currently reads from environment variable
    this.apiKey = Constants.expoConfig?.extra?.GEMINI_API_KEY || 
                  process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
    // Use gemini-2.0-flash model with v1beta API (required for vision)
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  }

  async parseImage(base64Image: string, mimeType: string): Promise<AIParseResult> {
    if (!this.apiKey) {
      return {
        success: false,
        transactions: [],
        error: 'Gemini API key not configured. Please add EXPO_PUBLIC_GEMINI_API_KEY to your environment.',
      };
    }

    // Get current date for context
    const today = new Date();
    const currentYear = today.getFullYear();
    const todayISO = today.toISOString().split('T')[0];

    const prompt = `Analyze this image which could be a receipt, invoice, bank statement screenshot, or transaction record.

TODAY'S DATE IS: ${todayISO} (Year: ${currentYear})

Extract ALL transactions visible in the image. For each transaction found, provide:
1. amount: The transaction amount as a positive number (no currency symbols)
2. note: A brief description (merchant name, item description, or transaction memo)
3. type: Either "expense" or "income" based on the transaction nature
4. suggestedCategory: Best matching category from this list: Food, Groceries, Dining, Lifestyle, Fitness, Entertainment, Travel, Transport, Home, Bills, Utilities, Rent, Gear, Creativity, Outdoors, Work Expenses, Pets, Family, Health, Education, Salary, Side Hustle, Client Work, Consulting, Investing, Bonus, Dividends, Other
5. date: The transaction date in ISO format (YYYY-MM-DD). IMPORTANT: If the year is not visible on the receipt, assume the current year (${currentYear}). Use today's date (${todayISO}) only if no date is visible at all.
6. confidence: Your confidence in this extraction (0.0 to 1.0)
7. location: Store/merchant location if visible (optional)

If this is a receipt with a single total, extract just that main transaction.
If this is a bank statement with multiple transactions, extract ALL of them.

IMPORTANT: Return ONLY valid JSON in this exact format, no other text:
{
  "transactions": [
    {
      "amount": 25.99,
      "note": "Grocery shopping at Walmart",
      "type": "expense",
      "suggestedCategory": "Groceries",
      "date": "${todayISO}",
      "confidence": 0.95,
      "location": "Walmart, 123 Main St"
    }
  ]
}

If you cannot extract any transactions, return: {"transactions": [], "error": "Could not identify any transactions in this image"}`;

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1, // Low temperature for more consistent parsing
            maxOutputTokens: 4096,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AI Parser] API error:', errorText);
        
        // Handle rate limiting
        if (response.status === 429) {
          return {
            success: false,
            transactions: [],
            error: 'AI service is temporarily busy. Please wait a moment and try again.',
          };
        }
        
        return {
          success: false,
          transactions: [],
          error: `API request failed: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      
      // Extract the text response from Gemini's response structure
      const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textContent) {
        return {
          success: false,
          transactions: [],
          error: 'No response content from AI',
          rawResponse: JSON.stringify(data),
        };
      }

      // Parse the JSON response - handle potential markdown code blocks
      let jsonStr = textContent.trim();
      
      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      const parsed = JSON.parse(jsonStr);

      if (parsed.error) {
        return {
          success: false,
          transactions: [],
          error: parsed.error,
          rawResponse: textContent,
        };
      }

      // Add unique IDs to each transaction
      const transactions: ExtractedTransaction[] = (parsed.transactions || []).map(
        (t: Omit<ExtractedTransaction, 'id'>, index: number) => ({
          ...t,
          id: `extracted-${Date.now()}-${index}`,
          amount: Math.abs(Number(t.amount) || 0),
          confidence: Number(t.confidence) || 0.5,
          type: t.type === 'income' ? 'income' : 'expense',
        })
      );

      return {
        success: true,
        transactions,
        rawResponse: textContent,
      };
    } catch (error) {
      console.error('[AI Parser] Error:', error);
      return {
        success: false,
        transactions: [],
        error: error instanceof Error ? error.message : 'Failed to parse image',
      };
    }
  }
}

// Singleton instance - can be swapped for different AI provider
let parserInstance: AIReceiptParser | null = null;

export const getAIReceiptParser = (): AIReceiptParser => {
  if (!parserInstance) {
    // Currently using Gemini - can be changed to OpenAI, Claude, etc.
    parserInstance = new GeminiReceiptParser();
  }
  return parserInstance;
};

/**
 * Main function to parse a receipt/statement image
 * @param base64Image - Base64 encoded image data (without data URL prefix)
 * @param mimeType - Image MIME type (e.g., 'image/jpeg', 'image/png')
 * @returns Promise with extraction results
 */
export const parseReceiptImage = async (
  base64Image: string,
  mimeType: string
): Promise<AIParseResult> => {
  const parser = getAIReceiptParser();
  return parser.parseImage(base64Image, mimeType);
};
