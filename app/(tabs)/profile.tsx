import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { lipana } from '@/lib/lipana';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
// removed useRouter (users moved to bottom tabs)
import Screen from '@/components/Screen';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function ProfileScreen() {
  const { user, staffProfile, signOut, refreshProfile } = useAuth();
  const name = staffProfile?.name || user?.user_metadata?.full_name || user?.email || 'Unknown';
  const email = user?.email ?? '';
  const role = staffProfile?.role ?? 'staff';
  const avatar = (staffProfile as any)?.avatar_url || user?.user_metadata?.avatar_url || null;
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState(name);
  const [showPaymentCard, setShowPaymentCard] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  function initials(text: string) {
    if (!text) return '';
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  async function pickAndUpload() {
    try {
      if (typeof (ImagePicker as any)?.requestMediaLibraryPermissionsAsync !== 'function') {
        console.warn('expo-image-picker not available in this runtime:', ImagePicker);
        Alert.alert(
          'Image picker unavailable',
          'The image picker native module is not available in this build. If you are using Expo Go you must rebuild a development client that includes `expo-image-picker`, or run a custom dev client via EAS.\n\nSee docs: https://docs.expo.dev/clients/installation/'
        );
        return;
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo access to change avatar.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      const uri = (res as any).assets?.[0]?.uri ?? (res as any).uri;
      if (!uri || res.canceled) return;
      setUploading(true);
      const response = await fetch(uri);
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.warn('fetch(uri) failed', response.status, text);
        Alert.alert('Upload failed', `Unable to read the selected image (status ${response.status}).`);
        setUploading(false);
        return;
      }
      const blob = await response.blob();
      const ext = uri.split('.').pop()?.split('?')[0] ?? 'jpg';
      const userId = user?.id ?? user?.user?.id;
      if (!userId) {
        Alert.alert('User not found');
        setUploading(false);
        return;
      }
      const fileName = `avatars/${userId}_${Date.now()}.${ext}`;
      const uploadRes = await supabase.storage.from('avatars').upload(fileName, blob, { cacheControl: '3600', upsert: true });
      console.warn('uploadRes', uploadRes);
      const uploadErr = (uploadRes as any)?.error ?? null;
      if (uploadErr) {
        console.warn('Supabase upload error', uploadErr);
        Alert.alert('Upload failed', uploadErr.message || 'Unknown upload error');
        setUploading(false);
        return;
      }
      const pubRes = await supabase.storage.from('avatars').getPublicUrl(fileName);
      console.warn('getPublicUrl res', pubRes);
      const urlData = (pubRes as any)?.data ?? null;
      const publicUrl = (urlData as any)?.publicUrl ?? (urlData as any)?.public_url ?? null;
      if (!publicUrl) {
        const pubErr = (pubRes as any)?.error ?? null;
        console.warn('No public URL', pubRes);
        Alert.alert('Upload succeeded but could not get public URL', pubErr?.message ?? 'No public URL returned');
        setUploading(false);
        return;
      }
      const { error: updErr } = await supabase.from('staff_profiles').update({ avatar_url: publicUrl }).eq('id', userId);
      if (updErr) {
        Alert.alert('Failed to save avatar', updErr.message);
        setUploading(false);
        return;
      }
      await refreshProfile(userId);
    } catch (e) {
      console.warn('Avatar upload error', e);
      Alert.alert('Error', 'Unable to upload avatar');
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    const userId = user?.id ?? user?.user?.id;
    if (!userId) return Alert.alert('User not found');
    try {
      const upd: any = {};
      if (editedName !== name) upd.name = editedName;
      if (Object.keys(upd).length === 0) {
        setEditing(false);
        return;
      }
      const { error } = await supabase.from('staff_profiles').update(upd).eq('id', userId);
      if (error) {
        console.warn('saveProfile error', error);
        Alert.alert('Failed to save', error.message || 'Unable to save profile');
        return;
      }
      await refreshProfile(userId);
      setEditing(false);
    } catch (e) {
      console.warn('saveProfile exception', e);
      Alert.alert('Error', 'Unable to save profile');
    }
  }

  async function handleSendSTK() {
    if (!paymentPhone.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }
    if (!paymentAmount.trim()) {
      Alert.alert('Error', 'Please enter an amount');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount < 10) {
      Alert.alert('Error', 'Amount must be at least KES 10');
      return;
    }

    try {
      setProcessingPayment(true);
      const response = await lipana.initiateStkPush({
        phone: paymentPhone,
        amount,
        accountReference: 'STAFF-PAYMENT',
        transactionDesc: `Staff Payment - ${name}`,
      });

      Alert.alert('Success', `STK Push sent to ${paymentPhone}\nTransaction ID: ${response.transactionId}\n\nCheck your phone for the M-Pesa prompt.`);
      setPaymentPhone('');
      setPaymentAmount('');
      setShowPaymentCard(false);
    } catch (err) {
      console.error('STK Push error:', err);
      Alert.alert('Error', 'Failed to send STK Push. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  }

  return (
    <Screen style={styles.container}>

      <View style={styles.card}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{initials(name)}</Text>
          </View>
        )}

        {editing ? (
          <TextInput value={editedName} onChangeText={setEditedName} style={styles.nameInput} placeholder="Full name" />
        ) : (
          <Text style={styles.name}>{name}</Text>
        )}

        <Text style={styles.role}>{role?.toString().toUpperCase()}</Text>

        <View style={styles.infoRow}>
          <Ionicons name="mail" size={18} color="#6b7280" />
          <Text style={styles.infoText}>{email}</Text>
        </View>

        <View style={styles.controlsRow}>
          <Pressable style={[styles.primaryBtn, styles.fullWidth]} onPress={pickAndUpload}>
            {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Change Avatar</Text>}
          </Pressable>

          {!editing ? (
            <Pressable style={[styles.secondaryBtn, styles.fullWidth]} onPress={() => { setEditedName(name); setEditing(true); }}>
              <Text style={styles.btnText}>Edit Profile</Text>
            </Pressable>
          ) : (
            <View style={{ width: '100%', alignItems: 'center' }}>
              <View style={styles.rowBtns}>
                <Pressable style={[styles.primaryBtn, styles.wideBtn]} onPress={saveProfile}>
                  <Text style={styles.btnText}>Save</Text>
                </Pressable>
                <Pressable style={[styles.dangerBtn, styles.wideBtn]} onPress={() => { setEditing(false); setEditedName(name); }}>
                  <Text style={styles.btnText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Manage Users removed from profile — available in bottom tabs */}

          <Pressable style={[styles.dangerBtn, styles.fullWidth]} onPress={() => signOut()}>
            <Text style={styles.btnText}>Sign Out</Text>
          </Pressable>
        </View>
      </View>

      {/* Payment Card */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="card" size={24} color="#2563eb" />
          <Text style={styles.sectionTitle}>Quick Payment</Text>
        </View>

        {!showPaymentCard ? (
          <Pressable style={styles.paymentToggleBtn} onPress={() => setShowPaymentCard(true)}>
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.btnText}>Send STK Push</Text>
          </Pressable>
        ) : (
          <View style={styles.paymentForm}>
            <Text style={styles.formLabel}>Phone Number</Text>
            <TextInput
              style={styles.formInput}
              placeholder="254708374149"
              placeholderTextColor="#cbd5e1"
              value={paymentPhone}
              onChangeText={setPaymentPhone}
              editable={!processingPayment}
              keyboardType="phone-pad"
            />

            <Text style={styles.formLabel}>Amount (KES)</Text>
            <TextInput
              style={styles.formInput}
              placeholder="100"
              placeholderTextColor="#cbd5e1"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              editable={!processingPayment}
              keyboardType="decimal-pad"
            />

            <View style={styles.paymentFormActions}>
              <Pressable
                style={[styles.primaryBtn, { flex: 1 }]}
                onPress={handleSendSTK}
                disabled={processingPayment}
              >
                {processingPayment ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={styles.btnText}>Send STK</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={[styles.dangerBtn, { flex: 1 }]}
                onPress={() => {
                  setShowPaymentCard(false);
                  setPaymentPhone('');
                  setPaymentAmount('');
                }}
                disabled={processingPayment}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </Pressable>
            </View>

            <Text style={styles.formHint}>
              Minimum amount: KES 10. You'll receive an M-Pesa prompt on your phone.
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { fontSize: 28, fontWeight: '700', color: '#111827' },
  card: { margin: 16, backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center', elevation: 0 },
  avatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 12, backgroundColor: '#fff' },
  avatarPlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarInitials: { fontSize: 36, fontWeight: '700', color: '#374151' },
  name: { fontSize: 22, fontWeight: '800', color: '#111827' },
  nameInput: { width: '100%', fontSize: 20, fontWeight: '700', color: '#111827', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, textAlign: 'center', marginBottom: 6 },
  role: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  infoText: { marginLeft: 8, color: '#374151' },
  signOutBtn: { backgroundColor: '#ef4444', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  signOutText: { color: '#fff', fontWeight: '700' },
  controlsRow: { marginTop: 16, width: '100%', alignItems: 'center', gap: 10 },
  primaryBtn: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 999, alignItems: 'center', width: '100%' },
  secondaryBtn: { backgroundColor: '#6b7280', paddingVertical: 12, borderRadius: 999, alignItems: 'center', width: '100%' },
  dangerBtn: { backgroundColor: '#ef4444', paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
  ghostBtn: { backgroundColor: '#ecfccb', paddingVertical: 12, borderRadius: 999, alignItems: 'center', width: '100%' },
  btnText: { color: '#fff', fontWeight: '700' },
  fullWidth: { width: '100%' },
  rowBtns: { flexDirection: 'row', gap: 12 },
  wideBtn: { minWidth: 140, alignItems: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  paymentToggleBtn: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  paymentForm: {
    gap: 12,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  paymentFormActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  formHint: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});
