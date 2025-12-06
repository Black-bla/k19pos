import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!email) return Alert.alert('Enter email', 'Please enter your account email.');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      setLoading(false);
      if (error) {
        Alert.alert('Reset failed', error.message);
        return;
      }
      Alert.alert('Check email', 'Password reset instructions sent.');
      router.replace('/(auth)/login');
    } catch (err) {
      setLoading(false);
      Alert.alert('Error', 'Unable to request password reset');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Pressable style={styles.button} onPress={handleReset} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Reset Link</Text>}
      </Pressable>
      <Pressable style={{ marginTop: 12 }} onPress={() => router.replace('/(auth)/login')}>
        <Text style={{ color: '#6b7280' }}>Back to login</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f9fafb' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  input: { width: '100%', maxWidth: 360, padding: 12, borderRadius: 8, backgroundColor: '#fff', marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  button: { width: '100%', maxWidth: 360, backgroundColor: '#10b981', padding: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
