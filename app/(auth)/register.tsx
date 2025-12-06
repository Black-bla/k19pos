import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Missing fields', 'Please fill name, email and password');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Mismatch', 'Password and confirmation do not match');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setLoading(false);
        Alert.alert('Sign up failed', error.message);
        return;
      }

      // If Supabase returns a user immediately, create staff_profiles row
      const userId = data?.user?.id;
      if (userId) {
        try {
          const payload: any = { id: userId, name: name, role: 'staff' };
          if (phone) payload.phone = phone;
          if (avatarUrl) payload.avatar_url = avatarUrl;
          await supabase.from('staff_profiles').insert(payload);
        } catch (err) {
          console.warn('Failed to create staff_profile', err);
        }
      }

      setLoading(false);
      // Notify the user to check email if confirmation required, otherwise go to login
      Alert.alert('Registered', 'Check your email for confirmation (if required). You can now sign in.');
      router.replace('/(auth)/login');
    } catch (err) {
      setLoading(false);
      console.warn('Register error', err);
      Alert.alert('Error', 'Unable to register');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Staff Account</Text>
      <TextInput style={styles.input} placeholder="Full name" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <TextInput style={styles.input} placeholder="Confirm password" secureTextEntry value={confirm} onChangeText={setConfirm} />
      <TextInput style={styles.input} placeholder="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextInput style={styles.input} placeholder="Avatar URL (optional)" value={avatarUrl} onChangeText={setAvatarUrl} autoCapitalize="none" />

      <Pressable style={styles.button} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register</Text>}
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
