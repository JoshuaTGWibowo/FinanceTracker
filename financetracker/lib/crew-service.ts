/**
 * Crew Service - Backend integration for crew features
 */

import { supabase } from './supabase';
import type { Database } from './supabase-types';

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
