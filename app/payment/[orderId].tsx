import { useTheme } from '@/context/ThemeContext';
import { supabase } from "@/lib/supabase";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function PaymentScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { orderId } = useLocalSearchParams();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [receipt, setReceipt] = useState("");

  async function handlePayment() {
    setLoading(true);
    setStatus("");
    setReceipt("");
    const { data, error } = await supabase.functions.invoke("mpesa-stk-push", {
      body: { order_id: orderId, phone_number: phone },
    });
    setLoading(false);
    if (error) {
      setStatus("failed");
      Alert.alert("Payment failed", error.message);
    } else {
      setStatus("success");
      setReceipt(data?.mpesa_receipt_number || "");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment</Text>
      <TextInput
        style={styles.input}
        placeholder="Customer Phone (07XXXXXXXX)"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <Pressable style={styles.button} onPress={handlePayment} disabled={loading || !phone}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Payment Request</Text>}
      </Pressable>
      {status === "success" && (
        <View style={styles.result}>
          <Text style={styles.success}>Payment Successful!</Text>
          <Text>Receipt: {receipt}</Text>
          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      )}
      {status === "failed" && (
        <View style={styles.result}>
          <Text style={styles.failed}>Payment Failed</Text>
          <Pressable style={styles.doneBtn} onPress={() => setStatus("")}>
            <Text style={styles.doneText}>Retry</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function createStyles(theme: any) {
  const c = theme.colors;
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
      backgroundColor: c.background,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      marginBottom: 32,
      color: c.text,
    },
    input: {
      width: "100%",
      maxWidth: 320,
      padding: 14,
      borderRadius: 8,
      backgroundColor: c.card,
      marginBottom: 16,
      fontSize: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    button: {
      width: "100%",
      maxWidth: 320,
      backgroundColor: c.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: "center",
      marginBottom: 24,
    },
    buttonText: {
      color: c.card,
      fontSize: 18,
      fontWeight: "700",
    },
    result: {
      alignItems: "center",
      marginTop: 24,
    },
    success: {
      color: c.success,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 8,
    },
    failed: {
      color: c.danger,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 8,
    },
    doneBtn: {
      backgroundColor: c.success,
      padding: 12,
      borderRadius: 8,
      marginTop: 16,
    },
    doneText: {
      color: c.card,
      fontSize: 16,
      fontWeight: "700",
    },
  });
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
    backgroundColor: "#3b82f6",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 24,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  result: {
    alignItems: "center",
    marginTop: 24,
  },
  success: {
    color: "#10b981",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  failed: {
    color: "#ef4444",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  doneBtn: {
    backgroundColor: "#10b981",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  doneText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
