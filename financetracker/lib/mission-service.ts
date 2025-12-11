/**
 * Mission Service
 * Handles mission fetching, progress tracking, and completion
 */

import { supabase } from './supabase';
import type { Transaction } from './types';
import { awardPoints } from './points-service';

export type MissionType = 'individual' | 'crew';
export type MissionGoalType = 'savings_rate' | 'streak' | 'budget_adherence' | 'transactions_logged';
export type MissionPeriod = 'daily' | 'weekly' | 'monthly';

export type Mission = {
  id: string;
  title: string;
  description: string;
  missionType: MissionType;
  goalType: MissionGoalType;
  goalTarget: number;
  pointsReward: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
};

export type UserMission = {
  id: string;
  userId: string;
  missionId: string;
  progress: number;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  mission?: Mission;
};

/**
 * Fetch all active missions
 */
export const getActiveMissions = async (
  missionType?: MissionType
): Promise<{ success: boolean; missions?: Mission[]; error?: string }> => {
  try {
    console.log(`[Mission Service] Fetching missions${missionType ? ` of type: ${missionType}` : ' (all types)'}`);
    
    let query = supabase
      .from('missions')
      .select('*')
      .eq('is_active', true);

    if (missionType) {
      query = query.eq('mission_type', missionType);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[Mission Service] Error fetching missions:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Mission Service] Fetched ${data?.length || 0} missions from database`);

    const missions: Mission[] = (data || []).map((m: any) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      missionType: m.mission_type,
      goalType: m.goal_type,
      goalTarget: m.goal_target,
      pointsReward: m.points_reward,
      startsAt: m.starts_at,
      endsAt: m.ends_at,
      isActive: m.is_active,
      createdAt: m.created_at,
    }));

    // Log mission details for debugging
    missions.forEach(m => {
      console.log(`[Mission Service] Mission "${m.title}": starts=${m.startsAt}, ends=${m.endsAt}, goal=${m.goalTarget}`);
    });

    return { success: true, missions };
  } catch (err) {
    console.error('Error in getActiveMissions:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Get user's mission progress
 */
export const getUserMissions = async (): Promise<{ 
  success: boolean; 
  userMissions?: UserMission[]; 
  error?: string;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('user_missions')
      .select(`
        *,
        mission:missions(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user missions:', error);
      return { success: false, error: error.message };
    }

    const userMissions: UserMission[] = (data || []).map((um: any) => ({
      id: um.id,
      userId: um.user_id,
      missionId: um.mission_id,
      progress: um.progress || 0,
      completed: um.completed || false,
      completedAt: um.completed_at,
      createdAt: um.created_at,
      mission: um.mission ? {
        id: um.mission.id,
        title: um.mission.title,
        description: um.mission.description,
        missionType: um.mission.mission_type,
        goalType: um.mission.goal_type,
        goalTarget: um.mission.goal_target,
        pointsReward: um.mission.points_reward,
        startsAt: um.mission.starts_at,
        endsAt: um.mission.ends_at,
        isActive: um.mission.is_active,
        createdAt: um.mission.created_at,
      } : undefined,
    }));

    return { success: true, userMissions };
  } catch (err) {
    console.error('Error in getUserMissions:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Calculate mission progress based on user activities
 */
export const calculateMissionProgress = (
  mission: Mission,
  transactions: Transaction[],
  currentStreak: number
): number => {
  const now = new Date();
  let startDate = new Date();
  
  // Determine the time window for this mission
  if (mission.startsAt) {
    startDate = new Date(mission.startsAt);
    // For daily missions, use start of the day to include all transactions from that day
    // This fixes the issue where mission starts at a specific time but transactions are normalized to midnight
    const desc = mission.description.toLowerCase();
    if (desc.includes('today') || (desc.includes('day') && !desc.includes('week') && !desc.includes('month'))) {
      startDate.setHours(0, 0, 0, 0);
    }
  } else {
    // Default to beginning of current day
    startDate.setHours(0, 0, 0, 0);
  }

  const relevantTransactions = transactions.filter(t => {
    const txDate = new Date(t.date);
    return txDate >= startDate && txDate <= now;
  });
  
  console.log(`[Mission Progress] "${mission.title}": ${transactions.length} total, ${relevantTransactions.length} in period`);
  console.log(`[Mission Progress] Period: ${startDate.toISOString()} to ${now.toISOString()}`);

  switch (mission.goalType) {
    case 'transactions_logged': {
      const count = relevantTransactions.length;
      const progress = Math.min((count / mission.goalTarget) * 100, 100);
      console.log(`[Mission Progress] ${mission.title}: ${count}/${mission.goalTarget} = ${progress.toFixed(1)}%`);
      return progress;
    }

    case 'streak': {
      return Math.min((currentStreak / mission.goalTarget) * 100, 100);
    }

    case 'budget_adherence': {
      // This would require budget data - for now return 0
      // TODO: Implement budget adherence calculation
      return 0;
    }

    case 'savings_rate': {
      const income = relevantTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const expenses = relevantTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      if (income === 0) return 0;
      
      const savingsRate = ((income - expenses) / income) * 100;
      return Math.min((savingsRate / mission.goalTarget) * 100, 100);
    }

    default:
      return 0;
  }
};

/**
 * Update mission progress for a user
 */
export const updateMissionProgress = async (params: {
  missionId: string;
  progress: number;
  mission?: Mission; // Pass mission to award points on completion
}): Promise<{ success: boolean; completed?: boolean; pointsAwarded?: number; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if already completed BEFORE updating
    const { data: existingMission } = await supabase
      .from('user_missions')
      .select('completed')
      .eq('user_id', user.id)
      .eq('mission_id', params.missionId)
      .single();

    // If already completed, don't update or award points
    if (existingMission?.completed) {
      console.log(`[Mission] ${params.missionId} already completed, skipping update`);
      return { success: true, completed: true, pointsAwarded: 0 };
    }

    const isCompleted = params.progress >= 100;
    const updateData: any = {
      progress: params.progress,
      completed: isCompleted,
    };

    if (isCompleted) {
      updateData.completed_at = new Date().toISOString();
      console.log(`[Mission] 🎯 Mission ${params.missionId} reached 100% - marking as completed`);
    }

    // Upsert user mission progress
    const { error } = await supabase
      .from('user_missions')
      .upsert({
        user_id: user.id,
        mission_id: params.missionId,
        ...updateData,
      }, {
        onConflict: 'user_id,mission_id',
      });

    if (error) {
      console.error('[Mission] Error updating mission progress:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Mission] Updated progress for ${params.missionId}: ${params.progress}% (completed: ${isCompleted})`);

    // Award points if just completed AND mission data is provided
    let pointsAwarded = 0;
    if (isCompleted && params.mission) {
      const pointResult = await awardPoints({
        points: params.mission.pointsReward,
        reason: `Completed mission: ${params.mission.title}`,
        period: 'all_time',
      });

      if (pointResult.success) {
        pointsAwarded = params.mission.pointsReward;
        console.log(`[Mission] ✅ Awarded ${pointsAwarded} pts for completing "${params.mission.title}"`);
      } else {
        console.error(`[Mission] Failed to award points:`, pointResult.error);
      }
    }

    return { success: true, completed: isCompleted, pointsAwarded };
  } catch (err) {
    console.error('Error in updateMissionProgress:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Complete a mission and award points
 */
export const completeMission = async (
  mission: Mission
): Promise<{ success: boolean; pointsAwarded?: number; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if mission is already completed
    const { data: existingMission } = await supabase
      .from('user_missions')
      .select('completed')
      .eq('user_id', user.id)
      .eq('mission_id', mission.id)
      .single();

    if (existingMission?.completed) {
      console.log('[Mission] Already completed:', mission.title);
      return { success: true, pointsAwarded: 0 };
    }

    // Award points
    const pointResult = await awardPoints({
      points: mission.pointsReward,
      reason: `Completed mission: ${mission.title}`,
      period: 'all_time',
    });

    if (!pointResult.success) {
      return { success: false, error: 'Failed to award points' };
    }

    console.log(`[Mission] ✅ Completed "${mission.title}" - Awarded ${mission.pointsReward} pts`);

    return {
      success: true,
      pointsAwarded: mission.pointsReward,
    };
  } catch (err) {
    console.error('Error in completeMission:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Check and update all missions for current user
 */
export const checkAndUpdateAllMissions = async (
  transactions: Transaction[],
  currentStreak: number
): Promise<{ success: boolean; completedMissions?: Mission[]; error?: string }> => {
  try {
    // Get all active missions
    const missionsResult = await getActiveMissions('individual');
    if (!missionsResult.success || !missionsResult.missions) {
      return { success: false, error: 'Failed to fetch missions' };
    }

    // Get user's current mission progress
    const userMissionsResult = await getUserMissions();
    const userMissionsMap = new Map(
      (userMissionsResult.userMissions || []).map(um => [um.missionId, um])
    );

    const completedMissions: Mission[] = [];

    // Check each mission
    for (const mission of missionsResult.missions) {
      // Skip if mission has ended
      if (mission.endsAt && new Date(mission.endsAt) < new Date()) {
        continue;
      }

      // Calculate current progress
      const progress = calculateMissionProgress(mission, transactions, currentStreak);
      const userMission = userMissionsMap.get(mission.id);

      // Skip if already completed
      if (userMission?.completed) {
        continue;
      }

      // Update progress (pass mission to award points on completion)
      const updateResult = await updateMissionProgress({
        missionId: mission.id,
        progress,
        mission, // Pass mission for point awarding
      });

      // Track completed missions
      if (updateResult.success && updateResult.completed) {
        completedMissions.push(mission);
        if (updateResult.pointsAwarded && updateResult.pointsAwarded > 0) {
          console.log(`[Mission] 🎊 "${mission.title}" completed! +${updateResult.pointsAwarded} pts`);
        }
      }
    }

    if (completedMissions.length > 0) {
      console.log(`[Mission] ✅ Total missions completed in this check: ${completedMissions.length}`);
    }

    return { success: true, completedMissions };
  } catch (err) {
    console.error('Error in checkAndUpdateAllMissions:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Get missions with progress for display
 */
export const getMissionsWithProgress = async (
  transactions: Transaction[],
  currentStreak: number,
  filter: 'all' | 'active' | 'completed' = 'active'
): Promise<{ 
  success: boolean; 
  missions?: Array<Mission & { progress: number; completed: boolean }>; 
  error?: string;
}> => {
  try {
    // Get all active missions
    const missionsResult = await getActiveMissions('individual');
    if (!missionsResult.success || !missionsResult.missions) {
      return { success: false, error: 'Failed to fetch missions' };
    }

    // Get user's progress
    const userMissionsResult = await getUserMissions();
    const userMissionsMap = new Map(
      (userMissionsResult.userMissions || []).map(um => [um.missionId, um])
    );

    // Combine mission data with progress
    let missions = missionsResult.missions.map(mission => {
      const userMission = userMissionsMap.get(mission.id);
      const progress = userMission?.progress || calculateMissionProgress(mission, transactions, currentStreak);
      const completed = userMission?.completed || false;

      return {
        ...mission,
        progress,
        completed,
      };
    });

    // Apply filter
    if (filter === 'active') {
      missions = missions.filter(m => !m.completed);
    } else if (filter === 'completed') {
      missions = missions.filter(m => m.completed);
    }

    return { success: true, missions };
  } catch (err) {
    console.error('Error in getMissionsWithProgress:', err);
    return { success: false, error: String(err) };
  }
};
