import { useMemo, useState, useEffect } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from 'expo-clipboard';

import { useAppTheme } from "../../theme";
import {
  createCrew,
  joinCrewWithCode,
  getUserCrew,
  getCrewMembers,
  leaveCrew,
  removeMemberFromCrew,
  disbandCrew,
  updateCrew,
} from "../../lib/crew-service";

type CrewData = {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  maxMembers: number;
  ownerId: string;
  ownerUsername: string;
  memberCount: number;
  userRole: 'owner' | 'admin' | 'member';
  logo: string | null;
};

type CrewMemberData = {
  userId: string;
  username: string;
  displayName: string | null;
  role: 'owner' | 'admin' | 'member';
  totalPoints: number;
  level: number;
  joinedAt: string;
};

export default function YourCrewScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [crewName, setCrewName] = useState('');
  const [crewDescription, setCrewDescription] = useState('');
  const [crewLogo, setCrewLogo] = useState('🛡️');
  const [crewCode, setCrewCode] = useState('');
  const [maxMembers, setMaxMembers] = useState(10);
  const [crewData, setCrewData] = useState<CrewData | null>(null);
  const [crewMembers, setCrewMembers] = useState<CrewMemberData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load crew data on mount
  useEffect(() => {
    loadCrewData();
  }, []);

  const loadCrewData = async () => {
    setIsLoading(true);
    const result = await getUserCrew();
    if (result.success && result.crew) {
      setCrewData(result.crew);
      // Load members
      const membersResult = await getCrewMembers(result.crew.id);
      if (membersResult.success && membersResult.members) {
        setCrewMembers(membersResult.members);
      }
    }
    setIsLoading(false);
  };

  const handleBack = () => {
    router.back();
  };

  const handleJoinCrew = async () => {
    if (!crewCode.trim()) {
      Alert.alert('Error', 'Please enter a crew code');
      return;
    }
    const formattedCode = crewCode.trim().toUpperCase();
    if (formattedCode.length !== 6) {
      Alert.alert('Error', 'Crew code must be 6 characters');
      return;
    }

    setIsProcessing(true);
    const result = await joinCrewWithCode(formattedCode);
    setIsProcessing(false);

    if (result.success) {
      setShowJoinModal(false);
      setCrewCode('');
      Alert.alert('Success! 🎉', 'You have joined the crew!', [
        { text: 'OK', onPress: () => loadCrewData() }
      ]);
    } else {
      Alert.alert('Error', result.error || 'Failed to join crew');
    }
  };

  const handleCreateCrew = async () => {
    if (!crewName.trim()) {
      Alert.alert('Error', 'Please enter a crew name');
      return;
    }

    setIsProcessing(true);
    const result = await createCrew({
      name: crewName.trim(),
      description: crewDescription.trim() || undefined,
      maxMembers,
    });
    setIsProcessing(false);

    if (result.success && result.crew) {
      // Close modal and reload data
      setShowCreateModal(false);
      setCrewName('');
      setCrewDescription('');
      await loadCrewData();
      
      // Show success message with invite code
      setTimeout(() => {
        Alert.alert(
          'Crew Created! 🎉',
          `Your crew "${result.crew!.name}" has been created!\n\nInvite Code: ${result.crew!.invite_code}\n\nShare this code with friends so they can join your crew.`,
          [
            { 
              text: 'Copy Code', 
              onPress: async () => {
                await Clipboard.setStringAsync(result.crew!.invite_code);
                Alert.alert('Copied!', `Code ${result.crew!.invite_code} copied to clipboard`);
              }
            },
            { text: 'OK' }
          ]
        );
      }, 300);
    } else {
      Alert.alert('Error', result.error || 'Failed to create crew');
    }
  };

  const handleLeaveCrew = () => {
    Alert.alert(
      'Leave Crew',
      'Are you sure you want to leave this crew?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Leave', 
          style: 'destructive', 
          onPress: async () => {
            if (!crewData) return;
            setIsProcessing(true);
            const result = await leaveCrew(crewData.id);
            setIsProcessing(false);
            
            if (result.success) {
              Alert.alert('Success', 'You have left the crew', [
                { text: 'OK', onPress: () => loadCrewData() }
              ]);
            } else {
              Alert.alert('Error', result.error || 'Failed to leave crew');
            }
          }
        },
      ]
    );
  };

  const handleRemoveMember = (memberId: string) => {
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this member from the crew?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive', 
          onPress: async () => {
            if (!crewData) return;
            setIsProcessing(true);
            const result = await removeMemberFromCrew(crewData.id, memberId);
            setIsProcessing(false);
            
            if (result.success) {
              Alert.alert('Success', 'Member removed from crew');
              loadCrewData();
            } else {
              Alert.alert('Error', result.error || 'Failed to remove member');
            }
          }
        },
      ]
    );
  };

  const handleInviteMembers = () => {
    if (!crewData) return;
    Alert.alert(
      'Invite Members',
      `Share your crew code with friends:\n\n${crewData.inviteCode}\n\nThey can join by entering this code in the "Join a Crew" screen.`,
      [
        { 
          text: 'Copy Code', 
          onPress: async () => {
            await Clipboard.setStringAsync(crewData.inviteCode);
            Alert.alert('Copied!', `Code ${crewData.inviteCode} copied to clipboard`);
          }
        },
        { text: 'OK', style: 'cancel' }
      ]
    );
  };

  const handleEditCrew = () => {
    if (!crewData) return;
    // Pre-fill current values
    setCrewName(crewData.name);
    setCrewDescription(crewData.description || '');
    setCrewLogo(crewData.logo || '🛡️');
    setShowEditModal(true);
  };

  const handleSaveCrewEdits = async () => {
    if (!crewData) return;
    if (!crewName.trim()) {
      Alert.alert('Error', 'Please enter a crew name');
      return;
    }

    setIsProcessing(true);
    const result = await updateCrew(crewData.id, {
      name: crewName.trim(),
      description: crewDescription.trim() || undefined,
      logo: crewLogo,
    });
    setIsProcessing(false);

    if (result.success) {
      setShowEditModal(false);
      Alert.alert('Success', 'Crew updated successfully!');
      await loadCrewData();
    } else {
      Alert.alert('Error', result.error || 'Failed to update crew');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Your Crew</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[styles.scrollContent, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // No Crew State
  if (!crewData && !showJoinModal && !showCreateModal) {
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

  // Edit Crew Modal
  if (showEditModal) {
    const emojiOptions = ['🛡️', '⚔️', '👑', '🏆', '🔥', '⭐', '💎', '🎯', '🚀', '💪', '🦁', '🐉', '🌟', '⚡', '🎮', '🎲'];
    
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <Pressable style={styles.backButton} onPress={() => setShowEditModal(false)}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Crew</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[theme.components.surface, styles.createForm]}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Crew Logo</Text>
              <View style={styles.emojiSelector}>
                {emojiOptions.map((emoji) => (
                  <Pressable
                    key={emoji}
                    style={[styles.emojiOption, crewLogo === emoji && styles.emojiOptionActive]}
                    onPress={() => setCrewLogo(emoji)}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

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
              <Text style={styles.formLabel}>Description</Text>
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

            <Pressable
              style={[theme.components.buttonPrimary, styles.createButton]}
              onPress={handleSaveCrewEdits}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color={theme.colors.text} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color={theme.colors.text} />
                  <Text style={styles.createButtonText}>Save Changes</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Member or Owner State - Show Crew Details
  if (!crewData) return null;

  const isOwner = crewData.userRole === 'owner';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Your Crew</Text>
        {isOwner && (
          <Pressable style={styles.headerAction} onPress={handleInviteMembers}>
            <Ionicons name="person-add" size={22} color={theme.colors.primary} />
          </Pressable>
        )}
        {!isOwner && <View style={{ width: 40 }} />}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Crew Header */}
        <View style={[theme.components.card, styles.crewHeader]}>
          <View style={styles.crewHeaderTop}>
            <View style={styles.crewShield}>
              <Text style={styles.crewLogo}>{crewData.logo || '🛡️'}</Text>
            </View>
            <View style={styles.crewHeaderInfo}>
              <Text style={styles.crewName}>{crewData.name}</Text>
              <Text style={styles.crewDescription}>{crewData.description || 'No description'}</Text>
              <View style={styles.crewStats}>
                <View style={styles.crewStat}>
                  <Ionicons name="people" size={16} color={theme.colors.accent} />
                  <Text style={styles.crewStatText}>
                    {crewData.memberCount}/{crewData.maxMembers} members
                  </Text>
                </View>
              </View>
            </View>
            {isOwner && (
              <Pressable style={styles.editCrewButton} onPress={handleEditCrew}>
                <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
              </Pressable>
            )}
          </View>

          {/* Invite Code Section */}
          <View style={styles.inviteCodeSection}>
            <View style={styles.inviteCodeHeader}>
              <Ionicons name="key" size={18} color={theme.colors.textMuted} />
              <Text style={styles.inviteCodeLabel}>Crew Invite Code</Text>
            </View>
            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCodeText}>{crewData.inviteCode}</Text>
              <Pressable 
                style={styles.copyCodeButton}
                onPress={async () => {
                  await Clipboard.setStringAsync(crewData.inviteCode);
                  Alert.alert('Copied!', `Code ${crewData.inviteCode} copied to clipboard`);
                }}
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
          
          {crewMembers.map((member) => (
            <View key={member.userId} style={[theme.components.surface, styles.memberCard]}>
              <View style={styles.memberAvatar}>
                <Ionicons name="person" size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberName}>{member.displayName || member.username}</Text>
                  {member.role === 'owner' && (
                    <View style={styles.ownerBadge}>
                      <Ionicons name="star" size={12} color="#FFD700" />
                      <Text style={styles.ownerBadgeText}>Owner</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.memberStats}>
                  Level {member.level} • {member.totalPoints} pts
                </Text>
              </View>
              {isOwner && member.role !== 'owner' && (
                <Pressable
                  style={styles.removeMemberButton}
                  onPress={() => handleRemoveMember(member.userId)}
                >
                  <Ionicons name="close-circle" size={24} color={theme.colors.danger} />
                </Pressable>
              )}
            </View>
          ))}
        </View>

        {/* Leave/Manage Crew */}
        {!isOwner && (
          <Pressable
            style={styles.leaveCrewButton}
            onPress={handleLeaveCrew}
          >
            <Ionicons name="exit-outline" size={20} color={theme.colors.danger} />
            <Text style={styles.leaveCrewButtonText}>Leave Crew</Text>
          </Pressable>
        )}

        {isOwner && (
          <View style={styles.ownerActions}>
            <Text style={styles.ownerActionsTitle}>Crew Management</Text>
            <Pressable style={styles.ownerActionButton}>
              <Ionicons name="settings-outline" size={20} color={theme.colors.text} />
              <Text style={styles.ownerActionButtonText}>Crew Settings</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </Pressable>
            <Pressable 
              style={[styles.ownerActionButton, styles.dangerAction]}
              onPress={() => {
                Alert.alert(
                  'Disband Crew',
                  'Are you sure you want to disband this crew? This action cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Disband', 
                      style: 'destructive', 
                      onPress: async () => {
                        setIsProcessing(true);
                        const result = await disbandCrew(crewData.id);
                        setIsProcessing(false);
                        
                        if (result.success) {
                          Alert.alert('Success', 'Crew has been disbanded', [
                            { text: 'OK', onPress: () => loadCrewData() }
                          ]);
                        } else {
                          Alert.alert('Error', result.error || 'Failed to disband crew');
                        }
                      }
                    },
                  ]
                );
              }}
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
              <Text style={[styles.ownerActionButtonText, styles.dangerActionText]}>Disband Crew</Text>
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

    // Emoji Selector
    emojiSelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    emojiOption: {
      width: 56,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    emojiOptionActive: {
      backgroundColor: theme.colors.primary + '20',
      borderColor: theme.colors.primary,
    },
    emojiText: {
      fontSize: 32,
    },

    // Crew Logo
    crewLogo: {
      fontSize: 48,
    },

    // Edit Button
    editCrewButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary + '20',
      borderRadius: theme.radii.md,
    },
  });
