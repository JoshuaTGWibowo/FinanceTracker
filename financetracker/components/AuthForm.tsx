import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '../theme';

interface AuthFormProps {
  onSuccess?: () => void;
}

export default function AuthForm({ onSuccess }: AuthFormProps) {
  const theme = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    if (isSignUp && !username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            data: {
              username: username.trim(),
              display_name: username.trim(),
            },
          },
        });

        if (error) throw error;

        Alert.alert(
          'Success',
          'Account created! Please check your email to verify your account.',
          [{ text: 'OK', onPress: onSuccess }]
        );
      } else {
        // Sign in
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });

        if (error) throw error;

        Alert.alert('Success', 'Signed in successfully!', [{ text: 'OK', onPress: onSuccess }]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      gap: 16,
    },
    input: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.colors.text,
    },
    button: {
      backgroundColor: theme.colors.primary,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    switchButton: {
      padding: 12,
      alignItems: 'center',
    },
    switchText: {
      color: theme.colors.textMuted,
      fontSize: 14,
    },
    linkText: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      
      {isSignUp && (
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          style={styles.input}
        />
      )}

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={theme.colors.textMuted}
        secureTextEntry
        autoCapitalize="none"
        style={styles.input}
      />

      <Pressable
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleAuth}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
        </Text>
      </Pressable>

      <Pressable style={styles.switchButton} onPress={() => setIsSignUp(!isSignUp)}>
        <Text style={styles.switchText}>
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <Text style={styles.linkText}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
        </Text>
      </Pressable>
    </View>
  );
}
