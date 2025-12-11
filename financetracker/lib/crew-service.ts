/**
 * Crew Service - Backend integration for crew features
 */

import { supabase } from './supabase';
import type { Database } from './supabase-types';
import type { Transaction, Category } from './types';
import { doesCategoryMatchBudget } from './categoryUtils';

type Crew = Database['public']['Tables']['crews']['Row'];
type CrewInsert = Database['public']['Tables']['crews']['Insert'];
type CrewMember = Database['public']['Tables']['crew_members']['Row'];

// Helper function to generate a random 6-character crew code
export const generateCrewCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars (I, O, 0, 1)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Check if crew code exists
export const checkCrewCodeExists = async (code: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('crews')
    .select('id')
    .eq('invite_code', code)
    .single();
  
  return !!data && !error;
};

// Generate unique crew code
export const generateUniqueCrewCode = async (): Promise<string> => {
  let code = generateCrewCode();
  let attempts = 0;
  const maxAttempts = 10;
  
  while (await checkCrewCodeExists(code) && attempts < maxAttempts) {
    code = generateCrewCode();
    attempts++;
  }
  
  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique crew code');
  }
  
  return code;
};

// Create a new crew
export const createCrew = async (params: {
  name: string;
  description?: string;
  maxMembers?: number;
}): Promise<{ success: boolean; crew?: Crew; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Generate unique invite code
    const inviteCode = await generateUniqueCrewCode();

    // Create crew
    const { data: crew, error } = await supabase
      .from('crews')
      .insert({
        name: params.name,
        description: params.description || null,
        owner_id: user.id,
        invite_code: inviteCode,
        max_members: params.maxMembers || 10,
        is_public: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating crew:', error);
      return { success: false, error: error.message };
    }

    // Add owner as crew member
    const { error: memberError } = await supabase
      .from('crew_members')
      .insert({
        crew_id: crew.id,
        user_id: user.id,
        role: 'owner',
      });

    if (memberError) {
      console.error('Error adding owner to crew:', memberError);
      // Rollback crew creation
      await supabase.from('crews').delete().eq('id', crew.id);
      return { success: false, error: 'Failed to add owner to crew' };
    }

    return { success: true, crew };
  } catch (error) {
    console.error('Error in createCrew:', error);
    return { success: false, error: String(error) };
  }
};

// Join crew with invite code
export const joinCrewWithCode = async (code: string): Promise<{ 
  success: boolean; 
  crewId?: string;
  error?: string;
}> => {
  try {
    const { data, error } = await supabase.rpc('join_crew_with_code', { code });

    if (error) {
      console.error('Error joining crew:', error);
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Failed to join crew' };
    }

    return { success: true, crewId: data.crew_id };
  } catch (error) {
    console.error('Error in joinCrewWithCode:', error);
    return { success: false, error: String(error) };
  }
};

// Get user's crew
export const getUserCrew = async (): Promise<{
  success: boolean;
  crew?: {
    id: string;
    name: string;
    description: string | null;
    inviteCode: string;
    logo: string | null;
    maxMembers: number;
    ownerId: string;
    ownerUsername: string;
    memberCount: number;
    userRole: 'owner' | 'admin' | 'member';
    joinedAt: string;
  };
  error?: string;
}> => {
  try {
    const { data, error } = await supabase.rpc('get_user_crew');

    if (error) {
      console.error('Error getting user crew:', error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: true, crew: undefined };
    }

    const crewData = data[0];
    return {
      success: true,
      crew: {
        id: crewData.crew_id,
        name: crewData.crew_name,
        description: crewData.crew_description,
        inviteCode: crewData.invite_code,
        logo: crewData.logo,
        maxMembers: crewData.max_members,
        ownerId: crewData.owner_id,
        ownerUsername: crewData.owner_username,
        memberCount: Number(crewData.member_count),
        userRole: crewData.user_role as 'owner' | 'admin' | 'member',
        joinedAt: crewData.joined_at,
      },
    };
  } catch (error) {
    console.error('Error in getUserCrew:', error);
    return { success: false, error: String(error) };
  }
};

// Get crew members with stats
export const getCrewMembers = async (crewId: string): Promise<{
  success: boolean;
  members?: Array<{
    userId: string;
    username: string;
    displayName: string | null;
    role: 'owner' | 'admin' | 'member';
    totalPoints: number;
    level: number;
    joinedAt: string;
  }>;
  error?: string;
}> => {
  try {
    const { data, error } = await supabase.rpc('get_crew_members', {
      p_crew_id: crewId,
    });

    if (error) {
      console.error('Error getting crew members:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      members: data.map((member: any) => ({
        userId: member.user_id,
        username: member.username,
        displayName: member.display_name,
        role: member.role,
        totalPoints: member.total_points,
        level: member.level,
        joinedAt: member.joined_at,
      })),
    };
  } catch (error) {
    console.error('Error in getCrewMembers:', error);
    return { success: false, error: String(error) };
  }
};

// Leave crew
export const leaveCrew = async (crewId: string): Promise<{ 
  success: boolean; 
  error?: string;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if user is the owner
    const { data: crew } = await supabase
      .from('crews')
      .select('owner_id')
      .eq('id', crewId)
      .single();

    if (crew?.owner_id === user.id) {
      return { success: false, error: 'Crew owner cannot leave. Transfer ownership or disband the crew.' };
    }

    const { error } = await supabase
      .from('crew_members')
      .delete()
      .eq('crew_id', crewId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error leaving crew:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in leaveCrew:', error);
    return { success: false, error: String(error) };
  }
};

// Remove member from crew (owner/admin only)
export const removeMemberFromCrew = async (
  crewId: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if user has permission (owner or admin)
    const { data: userMembership } = await supabase
      .from('crew_members')
      .select('role')
      .eq('crew_id', crewId)
      .eq('user_id', user.id)
      .single();

    if (!userMembership || (userMembership.role !== 'owner' && userMembership.role !== 'admin')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Cannot remove the owner
    const { data: targetMembership } = await supabase
      .from('crew_members')
      .select('role')
      .eq('crew_id', crewId)
      .eq('user_id', memberId)
      .single();

    if (targetMembership?.role === 'owner') {
      return { success: false, error: 'Cannot remove the crew owner' };
    }

    const { error } = await supabase
      .from('crew_members')
      .delete()
      .eq('crew_id', crewId)
      .eq('user_id', memberId);

    if (error) {
      console.error('Error removing member:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in removeMemberFromCrew:', error);
    return { success: false, error: String(error) };
  }
};

// Update crew details (owner only)
export const updateCrew = async (
  crewId: string,
  updates: {
    name?: string;
    description?: string;
    logo?: string; // URL or emoji
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if user is the owner
    const { data: crew } = await supabase
      .from('crews')
      .select('owner_id')
      .eq('id', crewId)
      .single();

    if (!crew || crew.owner_id !== user.id) {
      return { success: false, error: 'Only the crew owner can update the crew' };
    }

    // Build update object
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.logo !== undefined) updateData.logo = updates.logo;
    
    if (Object.keys(updateData).length === 0) {
      return { success: false, error: 'No updates provided' };
    }

    updateData.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('crews')
      .update(updateData)
      .eq('id', crewId);

    if (error) {
      console.error('Error updating crew:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateCrew:', error);
    return { success: false, error: String(error) };
  }
};

// Disband crew (owner only)
export const disbandCrew = async (crewId: string): Promise<{ 
  success: boolean; 
  error?: string;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if user is the owner
    const { data: crew } = await supabase
      .from('crews')
      .select('owner_id')
      .eq('id', crewId)
      .single();

    if (!crew || crew.owner_id !== user.id) {
      return { success: false, error: 'Only the crew owner can disband the crew' };
    }

    // Delete crew (cascade will remove crew_members)
    const { error } = await supabase
      .from('crews')
      .delete()
      .eq('id', crewId);

    if (error) {
      console.error('Error disbanding crew:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in disbandCrew:', error);
    return { success: false, error: String(error) };
  }
};

// ==================== Crew Budget/Goals ====================

export type CrewBudget = {
  id: string;
  crewId: string;
  name: string;
  target: number;
  period: 'week' | 'month';
  category: string;
  isRepeating: boolean;
  createdAt: string;
  updatedAt: string;
  currentSpending?: number; // Calculated from transactions
  progress?: number; // Percentage (0-100)
};

// Helper function to get date range for budget period
const getBudgetPeriodDates = (period: 'week' | 'month', createdAt: string): { startDate: string; endDate: string } => {
  const now = new Date();
  const created = new Date(createdAt);
  
  if (period === 'week') {
    // Get start of current week (Monday)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Don't go before budget creation date
    const startDate = startOfWeek > created ? startOfWeek : created;
    const endDate = new Date(now);
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  } else {
    // Get start of current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    // Don't go before budget creation date
    const startDate = startOfMonth > created ? startOfMonth : created;
    const endDate = new Date(now);
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }
};

// Calculate crew budget spending from local transactions
// NOTE: This uses local data only. For full crew tracking, transactions need to be synced to Supabase
export const calculateCrewBudgetSpendingLocal = (
  transactions: Transaction[],
  budget: CrewBudget,
  allCategories: Category[]
): number => {
  try {
    const { startDate, endDate } = getBudgetPeriodDates(budget.period, budget.createdAt);
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Filter local transactions for this category and period
    // Includes both direct matches and child category matches
    const filteredTransactions = transactions.filter(t => {
      const txDate = new Date(t.date);
      const inDateRange = txDate >= start && txDate <= end;
      const isExpense = t.type === 'expense';
      const matchesCategory = doesCategoryMatchBudget(t.category, budget.category, allCategories);
      
      return isExpense && matchesCategory && inDateRange;
    });

    // Sum up all expense amounts
    const totalSpending = filteredTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    return totalSpending;
  } catch (error) {
    console.error('Error calculating budget spending:', error);
    return 0;
  }
};

// Calculate crew budget spending from all members' transactions (requires Supabase sync)
export const calculateCrewBudgetSpending = async (
  crewId: string,
  budget: CrewBudget
): Promise<number> => {
  try {
    // Get all crew member IDs
    const { data: members } = await supabase
      .from('crew_members')
      .select('user_id')
      .eq('crew_id', crewId);

    if (!members || members.length === 0) {
      return 0;
    }

    const memberIds = members.map(m => m.user_id);
    const { startDate, endDate } = getBudgetPeriodDates(budget.period, budget.createdAt);

    // Try to fetch transactions from Supabase
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('amount, type')
      .in('user_id', memberIds)
      .eq('category', budget.category)
      .eq('type', 'expense')
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      // Table doesn't exist yet - return 0
      return 0;
    }

    // Sum up all expense amounts
    const totalSpending = (transactions || []).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    return totalSpending;
  } catch (error) {
    console.error('Error calculating budget spending:', error);
    return 0;
  }
};

// Get crew budgets
export const getCrewBudgets = async (crewId: string): Promise<{
  success: boolean;
  budgets?: CrewBudget[];
  error?: string;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // NOTE: Run crew-budgets-schema.sql in Supabase SQL Editor before using this feature
    const { data: budgets, error } = await supabase
      .from('crew_budgets')
      .select('*')
      .eq('crew_id', crewId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching crew budgets:', error);
      // Return empty array instead of error for smoother UX if table doesn't exist yet
      return { success: true, budgets: [] };
    }

    const formattedBudgets: CrewBudget[] = (budgets || []).map(b => ({
      id: b.id,
      crewId: b.crew_id,
      name: b.name,
      target: parseFloat(b.target),
      period: b.period as 'week' | 'month',
      category: b.category,
      isRepeating: b.is_repeating ?? true,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
    }));

    // Calculate spending for each budget
    const budgetsWithSpending = await Promise.all(
      formattedBudgets.map(async (budget) => {
        const spending = await calculateCrewBudgetSpending(crewId, budget);
        const progress = budget.target > 0 ? Math.min((spending / budget.target) * 100, 100) : 0;
        
        return {
          ...budget,
          currentSpending: spending,
          progress: Math.round(progress)
        };
      })
    );

    return { success: true, budgets: budgetsWithSpending };
  } catch (error) {
    console.error('Error in getCrewBudgets:', error);
    return { success: false, error: String(error) };
  }
};

// Create crew budget (owner only)
export const createCrewBudget = async (params: {
  crewId: string;
  name: string;
  target: number;
  period: 'week' | 'month';
  category: string;
  isRepeating?: boolean;
}): Promise<{
  success: boolean;
  budget?: CrewBudget;
  error?: string;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if user is the owner
    const { data: crew } = await supabase
      .from('crews')
      .select('owner_id')
      .eq('id', params.crewId)
      .single();

    if (!crew || crew.owner_id !== user.id) {
      return { success: false, error: 'Only the crew owner can create budgets' };
    }

    // NOTE: Run crew-budgets-schema.sql in Supabase SQL Editor before using this feature
    const { data: budget, error } = await supabase
      .from('crew_budgets')
      .insert({
        crew_id: params.crewId,
        name: params.name,
        target: params.target,
        period: params.period,
        category: params.category,
        is_repeating: params.isRepeating ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating crew budget:', error);
      return { success: false, error: error.message };
    }

    const formattedBudget: CrewBudget = {
      id: budget.id,
      crewId: budget.crew_id,
      name: budget.name,
      target: parseFloat(budget.target),
      period: budget.period as 'week' | 'month',
      category: budget.category,
      isRepeating: budget.is_repeating ?? true,
      createdAt: budget.created_at,
      updatedAt: budget.updated_at,
    };

    return { success: true, budget: formattedBudget };
  } catch (error) {
    console.error('Error in createCrewBudget:', error);
    return { success: false, error: String(error) };
  }
};

// Update crew budget (owner only)
export const updateCrewBudget = async (params: {
  budgetId: string;
  crewId: string;
  name?: string;
  target?: number;
  period?: 'week' | 'month';
  category?: string;
}): Promise<{
  success: boolean;
  budget?: CrewBudget;
  error?: string;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if user is the owner
    const { data: crew } = await supabase
      .from('crews')
      .select('owner_id')
      .eq('id', params.crewId)
      .single();

    if (!crew || crew.owner_id !== user.id) {
      return { success: false, error: 'Only the crew owner can update budgets' };
    }

    // NOTE: Run crew-budgets-schema.sql in Supabase SQL Editor before using this feature
    const updates: any = {};
    if (params.name !== undefined) updates.name = params.name;
    if (params.target !== undefined) updates.target = params.target;
    if (params.period !== undefined) updates.period = params.period;
    if (params.category !== undefined) updates.category = params.category;

    const { data: budget, error } = await supabase
      .from('crew_budgets')
      .update(updates)
      .eq('id', params.budgetId)
      .select()
      .single();

    if (error) {
      console.error('Error updating crew budget:', error);
      return { success: false, error: error.message };
    }

    const formattedBudget: CrewBudget = {
      id: budget.id,
      crewId: budget.crew_id,
      name: budget.name,
      target: parseFloat(budget.target),
      period: budget.period as 'week' | 'month',
      category: budget.category,
      isRepeating: budget.is_repeating ?? true,
      createdAt: budget.created_at,
      updatedAt: budget.updated_at,
    };

    return { success: true, budget: formattedBudget };
  } catch (error) {
    console.error('Error in updateCrewBudget:', error);
    return { success: false, error: String(error) };
  }
};

// Delete crew budget (owner only)
export const deleteCrewBudget = async (params: {
  budgetId: string;
  crewId: string;
}): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if user is the owner
    const { data: crew } = await supabase
      .from('crews')
      .select('owner_id')
      .eq('id', params.crewId)
      .single();

    if (!crew || crew.owner_id !== user.id) {
      return { success: false, error: 'Only the crew owner can delete budgets' };
    }

    // NOTE: Run crew-budgets-schema.sql in Supabase SQL Editor before using this feature
    const { error } = await supabase
      .from('crew_budgets')
      .delete()
      .eq('id', params.budgetId);

    if (error) {
      console.error('Error deleting crew budget:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in deleteCrewBudget:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Sync local transaction spending to Supabase for crew budget collaboration
 * Calculates aggregated spending without exposing individual transaction details
 */
export const syncBudgetContribution = async (params: {
  crewId: string;
  budget: CrewBudget;
  transactions: Transaction[];
  allCategories: Category[];
}): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Calculate spending for this budget period from local transactions
    const { startDate, endDate } = getBudgetPeriodDates(
      params.budget.period,
      params.budget.createdAt
    );

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Filter transactions matching budget category (including child categories)
    const relevantTransactions = params.transactions.filter(t => {
      if (t.type !== 'expense') return false;
      
      const txDate = new Date(t.date);
      const inDateRange = txDate >= start && txDate <= end;
      const matchesCategory = doesCategoryMatchBudget(t.category, params.budget.category, params.allCategories);
      
      return inDateRange && matchesCategory;
    });

    const totalSpent = relevantTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const transactionCount = relevantTransactions.length;

    // Upsert contribution record (update if exists, insert if not)
    // NOTE: Run crew-budget-contributions-schema.sql in Supabase SQL Editor before using this feature
    const { error } = await supabase
      .from('crew_budget_contributions')
      .upsert({
        crew_id: params.crewId,
        budget_id: params.budget.id,
        user_id: user.id,
        period_start: startDate,
        period_end: endDate,
        total_spent: totalSpent,
        transaction_count: transactionCount,
        last_synced_at: new Date().toISOString(),
      }, {
        onConflict: 'budget_id,user_id,period_start'
      });

    if (error) {
      console.error('Error syncing budget contribution:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in syncBudgetContribution:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Calculate total crew spending for a budget from all members' contributions
 * This replaces calculateCrewBudgetSpending to use aggregated data
 */
export const calculateCrewBudgetSpendingFromContributions = async (
  budgetId: string
): Promise<number> => {
  try {
    // NOTE: Run crew-budget-contributions-schema.sql in Supabase SQL Editor before using this feature
    const { data: contributions, error } = await supabase
      .from('crew_budget_contributions')
      .select('total_spent')
      .eq('budget_id', budgetId);

    if (error) {
      console.info('Contributions table not available yet:', error.message);
      return 0;
    }

    if (!contributions || contributions.length === 0) {
      return 0;
    }

    // Sum all crew members' contributions
    const totalSpending = contributions.reduce(
      (sum, contrib) => sum + parseFloat(contrib.total_spent.toString()),
      0
    );

    return totalSpending;
  } catch (error) {
    console.error('Error calculating crew budget spending from contributions:', error);
    return 0;
  }
};
