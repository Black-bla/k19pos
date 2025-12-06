import Screen from '@/components/Screen';
import { supabase } from "@/lib/supabase";
import { router } from 'expo-router';
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    // basic validation
    if (!email || !password) {
      Alert.alert('Missing credentials', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert("Login failed", error.message);
      return;
    }
    // successful login: navigate to tabs layout
    try {
      router.replace('/(tabs)');
    } catch (err) {
      // swallow navigation errors but inform if needed
      console.warn('Navigation after login failed', err);
    }
  }

  return (
    <Screen style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
      </Pressable>
      <View style={{ marginTop: 12 }}>
        <Pressable onPress={() => router.push('/(auth)/forgot-password')}>
          <Text style={{ color: '#6b7280' }}>Forgot password?</Text>
        </Pressable>
        <Pressable style={{ marginTop: 8 }} onPress={() => router.push('/(auth)/register')}>
          <Text style={{ color: '#6b7280' }}>Create an account</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f9fafb",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 32,
    color: "#111827",
  },
  input: {
    width: "100%",
    maxWidth: 320,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  button: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#10b981",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});
