import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme } from "../../theme";

type CrewState = 'none' | 'member' | 'owner';

// Mock crew data
const mockCrewData = {
  id: '1',
  name: 'Finance Warriors',
  description: 'We save together, we win together! 💪',
  inviteCode: 'FW2K9X',
  memberCount: 5,
  maxMembers: 10,
  owner: {
    id: 'owner-1',
    username: 'Josh77',
    displayName: 'Josh77',
  },
  members: [
    { id: '1', username: 'Josh77', displayName: 'Josh77', points: 850, level: 9, isOwner: true },
    { id: '2', username: 'FinanceNinja', displayName: 'Finance Ninja', points: 2450, level: 15, isOwner: false },
    { id: '3', username: 'BudgetMaster', displayName: 'Budget Master', points: 1820, level: 13, isOwner: false },
    { id: '4', username: 'SavingsKing', displayName: 'Savings King', points: 1560, level: 12, isOwner: false },
    { id: '5', username: 'MoneyWise', displayName: 'Money Wise', points: 1340, level: 11, isOwner: false },
  ],
};

// Helper function to generate a random 6-character crew code
const generateCrewCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars (I, O, 0, 1)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export default function YourCrewScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  // For demo purposes, toggle between states
  const [crewState, setCrewState] = useState<CrewState>('none'); // Change to 'member' or 'owner' to see other states
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [crewName, setCrewName] = useState('');
  const [crewDescription, setCrewDescription] = useState('');
  const [crewCode, setCrewCode] = useState('');
  const [maxMembers, setMaxMembers] = useState(10);
  const [generatedCode, setGeneratedCode] = useState('');

  const handleBack = () => {
    router.back();
  };

  const handleJoinCrew = () => {
    if (!crewCode.trim()) {
      Alert.alert('Error', 'Please enter a crew code');
      return;
    }
    const formattedCode = crewCode.trim().toUpperCase();
    if (formattedCode.length !== 6) {
      Alert.alert('Error', 'Crew code must be 6 characters');
      return;
    }
    // TODO: Implement actual join logic with Supabase
    Alert.alert('Join Crew', `Joining crew with code: ${formattedCode}\nThis will be implemented with backend integration.`);
  };

  const handleCreateCrew = () => {
    if (!crewName.trim()) {
      Alert.alert('Error', 'Please enter a crew name');
      return;
    }
    const newCode = generateCrewCode();
    setGeneratedCode(newCode);
    // TODO: Implement actual create logic with Supabase
    
    // Close modal and show crew management page
    setShowCreateModal(false);
    setCrewState('owner');
    
    // Show success message with invite code
    setTimeout(() => {
      Alert.alert(
        'Crew Created! 🎉',
        `Your crew "${crewName}" has been created!\n\nInvite Code: ${newCode}\n\nShare this code with friends so they can join your crew.`,
        [
          { 
            text: 'Copy Code', 
            onPress: () => {
              // TODO: Add clipboard copy functionality
              Alert.alert('Copied!', `Code ${newCode} copied to clipboard`);
            }
          },
          { text: 'OK' }
        ]
      );
    }, 300);
  };

  const handleLeaveCrew = () => {
    Alert.alert(
      'Leave Crew',
      'Are you sure you want to leave this crew?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => setCrewState('none') },
      ]
    );
  };

  const handleRemoveMember = (memberId: string) => {
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this member from the crew?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => {} },
      ]
    );
  };

  const handleInviteMembers = () => {
    Alert.alert(
      'Invite Members',
      `Share your crew code with friends:\n\n${mockCrewData.inviteCode}\n\nThey can join by entering this code in the "Join a Crew" screen.`,
      [
        { 
          text: 'Copy Code', 
          onPress: () => {
            // TODO: Add clipboard copy functionality
            Alert.alert('Copied!', `Code ${mockCrewData.inviteCode} copied to clipboard`);
          }
        },
        { text: 'OK', style: 'cancel' }
      ]
    );
  };

  // No Crew State
  if (crewState === 'none' && !showJoinModal && !showCreateModal) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Your Crew</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons name="people-outline" size={64} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>You're not in a crew yet</Text>
            <Text style={styles.emptySubtitle}>
              Join forces with friends to complete missions together and climb the leaderboard!
            </Text>
          </View>

          <View style={styles.actionButtons}>
            <Pressable 
              style={[theme.components.buttonPrimary, styles.primaryActionButton]}
              onPress={() => setShowJoinModal(true)}
            >
              <Ionicons name="enter" size={20} color={theme.colors.text} />
              <Text style={styles.primaryActionButtonText}>Join a Crew</Text>
            </Pressable>

            <Pressable 
              style={[theme.components.buttonSecondary, styles.secondaryActionButton]}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color={theme.colors.text} />
              <Text style={styles.secondaryActionButtonText}>Create a Crew</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Join Crew Modal
  if (showJoinModal) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <Pressable style={styles.backButton} onPress={() => setShowJoinModal(false)}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Join a Crew</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.joinHeroCard}>
            <View style={styles.joinIconWrapper}>
              <Ionicons name="key" size={48} color={theme.colors.primary} />
            </View>
            <Text style={styles.joinHeroTitle}>Enter Crew Code</Text>
            <Text style={styles.joinHeroSubtitle}>
              Ask your crew owner for the 6-character invite code to join their crew
            </Text>
          </View>

          <View style={[theme.components.surface, styles.joinForm]}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Crew Code</Text>
              <TextInput
                value={crewCode}
                onChangeText={(text) => setCrewCode(text.toUpperCase())}
                placeholder="Enter 6-character code"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.formInput, styles.codeInput]}
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Text style={styles.formHint}>Example: FW2K9X</Text>
            </View>

            <Pressable
              style={[theme.components.buttonPrimary, styles.joinSubmitButton]}
              onPress={handleJoinCrew}
            >
              <Ionicons name="enter" size={20} color={theme.colors.text} />
              <Text style={styles.joinSubmitButtonText}>Join Crew</Text>
            </Pressable>
          </View>

          <View style={styles.joinInfo}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.textMuted} />
            <Text style={styles.joinInfoText}>
              Don't have a code? Ask a friend to create a crew and share their invite code with you.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Create Crew Modal
  if (showCreateModal) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <Pressable style={styles.backButton} onPress={() => setShowCreateModal(false)}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Create a Crew</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[theme.components.surface, styles.createForm]}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Crew Name</Text>
              <TextInput
                value={crewName}
                onChangeText={setCrewName}
                placeholder="Enter crew name"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.formInput}
                maxLength={30}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Description (Optional)</Text>
              <TextInput
                value={crewDescription}
                onChangeText={setCrewDescription}
                placeholder="What's your crew about?"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.formInput, styles.formTextArea]}
                multiline
                numberOfLines={3}
                maxLength={100}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Max Members</Text>
              <View style={styles.maxMembersSelector}>
                {[5, 10, 15, 20].map((count) => (
                  <Pressable
                    key={count}
                    style={[styles.maxMemberOption, count === maxMembers && styles.maxMemberOptionActive]}
                    onPress={() => setMaxMembers(count)}
                  >
                    <Text style={[styles.maxMemberOptionText, count === maxMembers && styles.maxMemberOptionTextActive]}>
                      {count}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              style={[theme.components.buttonPrimary, styles.createButton]}
              onPress={handleCreateCrew}
            >
              <Text style={styles.createButtonText}>Create Crew</Text>
            </Pressable>
          </View>

          <View style={styles.createInfo}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.textMuted} />
            <Text style={styles.createInfoText}>
              As the crew owner, you'll be able to manage members and crew settings.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Member or Owner State - Show Crew Details
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Your Crew</Text>
        {crewState === 'owner' && (
          <Pressable style={styles.headerAction} onPress={handleInviteMembers}>
            <Ionicons name="person-add" size={22} color={theme.colors.primary} />
          </Pressable>
        )}
        {crewState === 'member' && <View style={{ width: 40 }} />}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Crew Header */}
        <View style={[theme.components.card, styles.crewHeader]}>
          <View style={styles.crewHeaderTop}>
            <View style={styles.crewShield}>
              <Ionicons name="shield" size={48} color={theme.colors.primary} />
            </View>
            <View style={styles.crewHeaderInfo}>
              <Text style={styles.crewName}>{mockCrewData.name}</Text>
              <Text style={styles.crewDescription}>{mockCrewData.description}</Text>
              <View style={styles.crewStats}>
                <View style={styles.crewStat}>
                  <Ionicons name="people" size={16} color={theme.colors.accent} />
                  <Text style={styles.crewStatText}>
                    {mockCrewData.memberCount}/{mockCrewData.maxMembers} members
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Invite Code Section */}
          <View style={styles.inviteCodeSection}>
            <View style={styles.inviteCodeHeader}>
              <Ionicons name="key" size={18} color={theme.colors.textMuted} />
              <Text style={styles.inviteCodeLabel}>Crew Invite Code</Text>
            </View>
            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCodeText}>{mockCrewData.inviteCode}</Text>
              <Pressable 
                style={styles.copyCodeButton}
                onPress={() => Alert.alert('Copied!', `Code ${mockCrewData.inviteCode} copied to clipboard`)}
              >
                <Ionicons name="copy-outline" size={20} color={theme.colors.primary} />
              </Pressable>
            </View>
            <Text style={styles.inviteCodeHint}>
              Share this code with friends to invite them to your crew
            </Text>
          </View>
        </View>

        {/* Members List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          
          {mockCrewData.members.map((member) => (
            <View key={member.id} style={[theme.components.surface, styles.memberCard]}>
              <View style={styles.memberAvatar}>
                <Ionicons name="person" size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberName}>{member.displayName}</Text>
                  {member.isOwner && (
                    <View style={styles.ownerBadge}>
                      <Ionicons name="star" size={12} color="#FFD700" />
                      <Text style={styles.ownerBadgeText}>Owner</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.memberStats}>
                  Level {member.level} • {member.points} pts
                </Text>
              </View>
              {crewState === 'owner' && !member.isOwner && (
                <Pressable
                  style={styles.removeMemberButton}
                  onPress={() => handleRemoveMember(member.id)}
                >
                  <Ionicons name="close-circle" size={24} color={theme.colors.danger} />
                </Pressable>
              )}
            </View>
          ))}
        </View>

        {/* Leave/Manage Crew */}
        {crewState === 'member' && (
          <Pressable
            style={styles.leaveCrewButton}
            onPress={handleLeaveCrew}
          >
            <Ionicons name="exit-outline" size={20} color={theme.colors.danger} />
            <Text style={styles.leaveCrewButtonText}>Leave Crew</Text>
          </Pressable>
        )}

        {crewState === 'owner' && (
          <View style={styles.ownerActions}>
            <Text style={styles.ownerActionsTitle}>Crew Management</Text>
            <Pressable style={styles.ownerActionButton}>
              <Ionicons name="settings-outline" size={20} color={theme.colors.text} />
              <Text style={styles.ownerActionButtonText}>Crew Settings</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </Pressable>
            <Pressable style={[styles.ownerActionButton, styles.dangerAction]}>
              <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
              <Text style={[styles.ownerActionButtonText, styles.dangerActionText]}>Delete Crew</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.danger} />
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (
  theme: ReturnType<typeof useAppTheme>,
  insets: ReturnType<typeof useSafeAreaInsets>,
) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    headerAction: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      padding: theme.spacing.md,
      paddingBottom: theme.spacing.xxl * 2 + insets.bottom,
    },

    // Empty State
    emptyState: {
      alignItems: 'center',
      paddingVertical: theme.spacing.xxl * 2,
      gap: theme.spacing.lg,
    },
    emptyIconWrapper: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.lg,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 15,
      color: theme.colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: theme.spacing.xl,
    },
    actionButtons: {
      gap: theme.spacing.md,
      marginTop: theme.spacing.xl,
    },
    primaryActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.lg,
    },
    primaryActionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    secondaryActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.lg,
    },
    secondaryActionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },

    // Join Crew Modal
    joinHeroCard: {
      alignItems: 'center',
      padding: theme.spacing.xxl,
      gap: theme.spacing.md,
    },
    joinIconWrapper: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.md,
    },
    joinHeroTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
    },
    joinHeroSubtitle: {
      fontSize: 15,
      color: theme.colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: theme.spacing.lg,
    },
    joinForm: {
      padding: theme.spacing.xl,
      gap: theme.spacing.xl,
      marginTop: theme.spacing.lg,
    },
    codeInput: {
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: 2,
      textAlign: 'center',
      fontFamily: 'monospace',
    },
    formHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
    },
    joinSubmitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.lg,
    },
    joinSubmitButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    joinInfo: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radii.md,
      marginTop: theme.spacing.lg,
    },
    joinInfoText: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.textMuted,
      lineHeight: 18,
    },

    // Crew Cards (Join List)
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.lg,
    },
    crewCard: {
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      gap: theme.spacing.md,
    },
    crewCardHeader: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    crewIconWrapper: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    crewCardInfo: {
      flex: 1,
      gap: 4,
    },
    crewCardName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    crewCardDescription: {
      fontSize: 14,
      color: theme.colors.textMuted,
      lineHeight: 20,
    },
    crewCardMembers: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.accent,
      marginTop: 4,
    },
    joinButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    joinButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },

    // Create Form
    createForm: {
      padding: theme.spacing.xl,
      gap: theme.spacing.xl,
    },
    formField: {
      gap: theme.spacing.sm,
    },
    formLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    formInput: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      color: theme.colors.text,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      fontSize: 15,
    },
    formTextArea: {
      paddingTop: theme.spacing.md,
      height: 80,
      textAlignVertical: 'top',
    },
    maxMembersSelector: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    maxMemberOption: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    maxMemberOptionActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    maxMemberOptionText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    maxMemberOptionTextActive: {
      color: theme.colors.text,
    },
    createButton: {
      paddingVertical: theme.spacing.lg,
      marginTop: theme.spacing.md,
    },
    createButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      textAlign: 'center',
    },
    createInfo: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radii.md,
      marginTop: theme.spacing.lg,
    },
    createInfoText: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.textMuted,
      lineHeight: 18,
    },

    // Crew Details
    crewHeader: {
      marginBottom: theme.spacing.xl,
    },
    crewHeaderTop: {
      flexDirection: 'row',
      gap: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
    },
    crewShield: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    crewHeaderInfo: {
      flex: 1,
      gap: theme.spacing.sm,
    },
    crewName: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text,
    },
    crewDescription: {
      fontSize: 14,
      color: theme.colors.textMuted,
      lineHeight: 20,
    },
    crewStats: {
      flexDirection: 'row',
      gap: theme.spacing.lg,
      marginTop: theme.spacing.sm,
    },
    crewStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    crewStatText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.accent,
    },

    // Invite Code Display
    inviteCodeSection: {
      marginTop: theme.spacing.xl,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radii.md,
      gap: theme.spacing.md,
    },
    inviteCodeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    inviteCodeLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    inviteCodeBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.md,
      borderWidth: 2,
      borderColor: theme.colors.primary + '40',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    inviteCodeText: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      letterSpacing: 3,
      fontFamily: 'monospace',
    },
    copyCodeButton: {
      padding: theme.spacing.sm,
      borderRadius: theme.radii.sm,
      backgroundColor: theme.colors.primary + '20',
    },
    inviteCodeHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textAlign: 'center',
      lineHeight: 16,
    },

    // Members List
    section: {
      marginBottom: theme.spacing.xl,
    },
    memberCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      gap: theme.spacing.md,
    },
    memberAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberInfo: {
      flex: 1,
      gap: 4,
    },
    memberNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    memberName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    ownerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      backgroundColor: '#FFD700' + '20',
      borderRadius: theme.radii.pill,
    },
    ownerBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#FFD700',
      textTransform: 'uppercase',
    },
    memberStats: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    removeMemberButton: {
      padding: theme.spacing.sm,
    },

    // Actions
    leaveCrewButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.danger + '20',
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.danger + '40',
      marginTop: theme.spacing.xl,
    },
    leaveCrewButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.danger,
    },
    ownerActions: {
      marginTop: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    ownerActionsTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    ownerActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radii.md,
    },
    ownerActionButtonText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    dangerAction: {
      backgroundColor: theme.colors.danger + '10',
    },
    dangerActionText: {
      color: theme.colors.danger,
    },
  });
