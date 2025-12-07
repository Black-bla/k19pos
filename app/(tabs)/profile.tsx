import ModalBox from '@/components/ModalBox';
import Screen from '@/components/Screen';
import { showToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { ThemePalette, useTheme } from '@/context/ThemeContext';
import { lipana } from '@/lib/lipana';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

export default function ProfileScreen() {
  const { user, staffProfile, signOut, refreshProfile } = useAuth();
  const { theme, preference, setPreference } = useTheme();
  const name = staffProfile?.name || user?.user_metadata?.full_name || user?.email || 'Unknown';
  const email = user?.email ?? '';
  const role = staffProfile?.role ?? 'staff';
  const avatar = (staffProfile as any)?.avatar_url || user?.user_metadata?.avatar_url || null;
  const phone = staffProfile?.phone || '';
  const userId = user?.id ?? user?.user?.id;
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState(name);
  const [editedPhone, setEditedPhone] = useState(phone);
  const [showPaymentCard, setShowPaymentCard] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [settings, setSettings] = useState({
    notifications: true,
    sound: true,
    vibration: true,
    autoRefresh: true,
    theme: preference,
    compactMode: false,
    reduceMotion: false,
  });
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('profile-settings-v1', JSON.stringify(settings)).catch((err) =>
      console.warn('Failed to persist settings', err)
    );
  }, [settings]);

  useEffect(() => {
    setSettings((prev) => ({ ...prev, theme: preference }));
  }, [preference]);

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
      
      // Use correct media type for new API
      const res = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ['images'], 
        quality: 0.8 
      });
      
      if (res.canceled) {
        setUploading(false);
        return;
      }

      // Handle both old and new response formats
      let uri: string | undefined;
      if (res.assets && res.assets.length > 0) {
        uri = res.assets[0].uri;
      } else if ((res as any).uri) {
        uri = (res as any).uri;
      }

      if (!uri) {
        console.warn('No URI found in picker response:', res);
        Alert.alert('Error', 'Failed to get image URI');
        setUploading(false);
        return;
      }
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
      
      // Convert blob to base64 for database storage
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        
        try {
          // Try uploading to Supabase storage first
          const fileName = `avatars/${userId}_${Date.now()}.${ext}`;
          console.log('Attempting Supabase storage upload to:', fileName);
          
          const uploadRes = await supabase.storage
            .from('avatars')
            .upload(fileName, blob, { cacheControl: '3600', upsert: true })
            .catch((err) => {
              console.warn('Storage upload failed, will use base64 fallback:', err);
              return { data: null, error: err };
            });
          
          let publicUrl: string | null = null;
          
          if (uploadRes.data && !uploadRes.error) {
            // Storage upload succeeded, get public URL
            const pubRes = await supabase.storage.from('avatars').getPublicUrl(fileName);
            const urlData = (pubRes as any)?.data ?? null;
            publicUrl = (urlData as any)?.publicUrl ?? (urlData as any)?.public_url ?? null;
            console.log('Storage upload succeeded, public URL:', publicUrl);
          } else {
            // Fallback to base64 in database
            console.log('Using base64 fallback for avatar');
            publicUrl = base64Data;
          }
          
          if (!publicUrl) {
            Alert.alert('Upload failed', 'Could not process avatar. Please try again.');
            setUploading(false);
            return;
          }
          
          // Save avatar URL (either cloud or base64) to database
          const { error: updErr } = await supabase
            .from('staff_profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', userId);
          
          if (updErr) {
            Alert.alert('Failed to save avatar', updErr.message);
            setUploading(false);
            return;
          }
          
          console.log('Avatar saved successfully');
          showToast('Avatar updated successfully', 'success');
          await refreshProfile(userId);
        } catch (uploadError) {
          console.warn('Avatar upload exception:', uploadError);
          Alert.alert(
            'Error',
            'Failed to upload avatar. Please check your internet connection and try again.'
          );
        } finally {
          setUploading(false);
        }
      };
      
      reader.onerror = () => {
        console.warn('FileReader error');
        Alert.alert('Error', 'Failed to read image file');
        setUploading(false);
      };
      
      reader.readAsDataURL(blob);
    } catch (e) {
      console.warn('Avatar upload error', e);
      Alert.alert('Error', 'Unable to upload avatar');
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    if (!userId) return Alert.alert('User not found');
    try {
      const upd: any = {};
      if (editedName !== name) upd.name = editedName;
      if (editedPhone !== phone) upd.phone = editedPhone;
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

      showToast(`Payment sent to ${paymentPhone}`, 'success');
      setPaymentPhone('');
      setPaymentAmount('');
      setShowPaymentCard(false);
    } catch (err) {
      console.error('STK Push error:', err);
      showToast('Failed to send payment', 'error');
    } finally {
      setProcessingPayment(false);
    }
  }

  async function loadSettings() {
    try {
      const cached = await AsyncStorage.getItem('profile-settings-v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.theme === 'light' || parsed?.theme === 'dark' || parsed?.theme === 'system') {
          setPreference(parsed.theme);
        }
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch (err) {
      console.warn('Failed to load settings', err);
    }
  }

  function handleSignOutPress() {
    setSignOutConfirm(true);
  }

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{initials(name)}</Text>
            </View>
          )}

          <Text style={styles.name}>{name}</Text>
          <Text style={styles.role}>{role?.toString().toUpperCase()}</Text>

          <View style={styles.infoRow}>
            <Ionicons name="mail" size={18} color="#6b7280" />
            <Text style={styles.infoText}>{email}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="call" size={18} color="#6b7280" />
            <Text style={styles.infoText}>{phone || 'No phone on file'}</Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Ionicons name="id-card" size={14} color="#0ea5e9" />
              <Text style={styles.metaText}>User ID: {userId?.slice(0, 8) || 'N/A'}</Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="shield-checkmark" size={14} color="#0ea5e9" />
              <Text style={styles.metaText}>Role: {role}</Text>
            </View>
          </View>

          {!editing && (
            <Pressable style={[styles.primaryBtn, styles.fullWidth, { marginTop: 16 }]} onPress={() => { setEditedName(name); setEditing(true); }}>
              <Ionicons name="pencil" size={18} color="#fff" />
              <Text style={styles.btnText}>Edit Profile</Text>
            </Pressable>
          )}
        </View>

        {/* Edit Profile Modal */}
        {editing && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Edit Profile</Text>
            
            <View style={{ width: '100%', gap: 12, marginTop: 16 }}>
              <View>
                <Text style={styles.formLabel}>Full Name</Text>
                <TextInput 
                  value={editedName} 
                  onChangeText={setEditedName} 
                  style={styles.formInput} 
                  placeholder="Full name" 
                />
              </View>

              <View>
                <Text style={styles.formLabel}>Phone Number</Text>
                <TextInput
                  value={editedPhone}
                  onChangeText={setEditedPhone}
                  style={styles.formInput}
                  placeholder="Phone number"
                  keyboardType="phone-pad"
                />
              </View>

              <View>
                <Text style={styles.formLabel}>Avatar</Text>
                <Pressable style={styles.primaryBtn} onPress={pickAndUpload}>
                  {uploading ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Ionicons name="image" size={18} color="#fff" />
                      <Text style={styles.btnText}>Change Avatar</Text>
                    </>
                  )}
                </Pressable>
              </View>

              <View style={styles.rowBtns}>
                <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={saveProfile}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.btnText}>Save</Text>
                </Pressable>
                <Pressable style={[styles.dangerBtn, { flex: 1 }]} onPress={() => { setEditing(false); setEditedName(name); setEditedPhone(phone); }}>
                  <Ionicons name="close" size={18} color="#fff" />
                  <Text style={styles.btnText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Payment Card */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="card" size={24} color="#2563eb" />
            <Text style={styles.sectionTitle}>Quick Payment</Text>
          </View>

          {!showPaymentCard ? (
            <Pressable style={styles.paymentToggleBtn} onPress={() => setShowPaymentCard(true)}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.btnText}>Initiate Payment</Text>
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
                      <Text style={styles.btnText}>Send Payment</Text>
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

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings" size={24} color="#2563eb" />
            <Text style={styles.sectionTitle}>Appearance</Text>
          </View>

          <View style={styles.settingRowStacked}>
            <View style={styles.settingTextBlock}>
              <Text style={styles.settingTitle}>Theme</Text>
              <Text style={styles.settingSubtitle}>Match system or force light/dark</Text>
            </View>
            <View style={styles.chipRow}>
              {['system', 'light', 'dark'].map((option) => (
                <Pressable
                  key={option}
                  style={[styles.chip, settings.theme === option && styles.chipSelected]}
                  onPress={() => {
                    setSettings((s) => ({ ...s, theme: option }));
                    setPreference(option as any);
                  }}
                >
                  <Text style={[styles.chipText, settings.theme === option && styles.chipTextSelected]}>
                    {option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextBlock}>
              <Text style={styles.settingTitle}>Compact mode</Text>
              <Text style={styles.settingSubtitle}>Tighter spacing for small screens</Text>
            </View>
            <Switch
              value={settings.compactMode}
              onValueChange={(v) => setSettings((s) => ({ ...s, compactMode: v }))}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextBlock}>
              <Text style={styles.settingTitle}>Reduce motion</Text>
              <Text style={styles.settingSubtitle}>Minimize animations to save battery</Text>
            </View>
            <Switch
              value={settings.reduceMotion}
              onValueChange={(v) => setSettings((s) => ({ ...s, reduceMotion: v }))}
            />
          </View>
        </View>

        {/* Settings */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings" size={24} color="#2563eb" />
            <Text style={styles.sectionTitle}>Settings</Text>
          </View>

        <View style={styles.settingRow}>
          <View style={styles.settingTextBlock}>
            <Text style={styles.settingTitle}>Notifications</Text>
            <Text style={styles.settingSubtitle}>Receive order and payment updates</Text>
          </View>
          <Switch
            value={settings.notifications}
            onValueChange={(v) => setSettings((s) => ({ ...s, notifications: v }))}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingTextBlock}>
            <Text style={styles.settingTitle}>Sound</Text>
            <Text style={styles.settingSubtitle}>Play alert sounds for new orders</Text>
          </View>
          <Switch
            value={settings.sound}
            onValueChange={(v) => setSettings((s) => ({ ...s, sound: v }))}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingTextBlock}>
            <Text style={styles.settingTitle}>Vibration</Text>
            <Text style={styles.settingSubtitle}>Vibrate on critical updates</Text>
          </View>
          <Switch
            value={settings.vibration}
            onValueChange={(v) => setSettings((s) => ({ ...s, vibration: v }))}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingTextBlock}>
            <Text style={styles.settingTitle}>Auto-refresh</Text>
            <Text style={styles.settingSubtitle}>Keep screens in sync automatically</Text>
          </View>
          <Switch
            value={settings.autoRefresh}
            onValueChange={(v) => setSettings((s) => ({ ...s, autoRefresh: v }))}
          />
        </View>
        </View>

        {/* Sign Out Section - At Bottom of Scroll */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="warning" size={24} color="#ef4444" />
            <Text style={styles.sectionTitle}>Danger Zone</Text>
          </View>
          <Text style={styles.dangerZoneText}>
            Signing out will end your current session. You'll need to log in again to access the app.
          </Text>
          <Pressable style={[styles.dangerBtn, styles.fullWidth, { marginTop: 16 }]} onPress={handleSignOutPress}>
            <Ionicons name="log-out" size={18} color="#fff" />
            <Text style={styles.btnText}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>

      {signOutConfirm && (
        <ModalBox
          title="Sign Out"
          subtitle="You will be logged out of this account. Make sure to save any important data."
          onClose={() => setSignOutConfirm(false)}
          onConfirm={() => {
            setSignOutConfirm(false);
            signOut();
          }}
          confirmLabel="Sign Out"
          cancelLabel="Stay Logged In"
          scrollable={false}
        >
          <View style={styles.modalBody}>
            <View style={styles.modalRow}>
              <View style={styles.modalIconDanger}>
                <Ionicons name="log-out" size={22} color="#ef4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>You will be logged out</Text>
                <Text style={styles.modalSubtitle}>
                  Active sessions will end. Any unsaved changes will be lost. You can sign back in anytime.
                </Text>
              </View>
            </View>
            <View style={styles.modalBulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.modalBulletText}>Make sure any ongoing work is saved</Text>
            </View>
            <View style={styles.modalBulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.modalBulletText}>You'll need your credentials to log back in</Text>
            </View>
          </View>
        </ModalBox>
      )}
    </Screen>
  );
}

function createStyles(theme: ThemePalette) {
  const c = theme.colors;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scrollContent: { paddingBottom: 100, paddingTop: 8 },
    header: { padding: 20, paddingTop: 60, backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border },
    title: { fontSize: 28, fontWeight: '700', color: c.text },
    card: {
      margin: 16,
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme.isDark ? 0.15 : 0.05,
      shadowRadius: 6,
      elevation: theme.isDark ? 0 : 1,
    },
    avatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 12, backgroundColor: c.card },
    avatarPlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: c.border, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    avatarInitials: { fontSize: 36, fontWeight: '700', color: c.text },
    name: { fontSize: 22, fontWeight: '800', color: c.text },
    nameInput: { width: '100%', fontSize: 20, fontWeight: '700', color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, textAlign: 'center', marginBottom: 6, backgroundColor: c.input },
    role: { fontSize: 12, color: c.muted, marginTop: 4 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    infoText: { marginLeft: 8, color: c.text },
    signOutBtn: { backgroundColor: c.danger, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    signOutText: { color: '#fff', fontWeight: '700' },
    controlsRow: { marginTop: 16, width: '100%', alignItems: 'center', gap: 10 },
    primaryBtn: { backgroundColor: c.primary, paddingVertical: 12, borderRadius: 999, alignItems: 'center', width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    secondaryBtn: { backgroundColor: c.muted, paddingVertical: 12, borderRadius: 999, alignItems: 'center', width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    dangerBtn: { backgroundColor: c.danger, paddingVertical: 12, borderRadius: 999, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    btnText: { color: '#fff', fontWeight: '700' },
    fullWidth: { width: '100%' },
    rowBtns: { flexDirection: 'row', gap: 12 },
    wideBtn: { minWidth: 140, alignItems: 'center' },
    inlineInput: { borderBottomWidth: 1, borderColor: c.border, paddingVertical: 2, paddingHorizontal: 4, minWidth: 140, color: c.text },
    metaRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
    metaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.isDark ? '#1f2937' : '#e0f2fe',
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    metaText: { fontSize: 12, fontWeight: '600', color: c.text },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    settingRowStacked: { width: '100%', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    settingTextBlock: { flex: 1, paddingRight: 12 },
    settingTitle: { fontSize: 14, fontWeight: '700', color: c.text },
    settingSubtitle: { fontSize: 12, color: c.subtext, marginTop: 2 },
    chipRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.input },
    chipSelected: { borderColor: c.primary, backgroundColor: theme.isDark ? 'rgba(96, 165, 250, 0.2)' : '#dbeafe' },
    chipText: { color: c.text, fontWeight: '600' },
    chipTextSelected: { color: c.primary },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
    },
    paymentToggleBtn: {
      backgroundColor: c.primary,
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
      color: c.text,
    },
    formInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: c.text,
      backgroundColor: c.input,
    },
    paymentFormActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    formHint: {
      fontSize: 12,
      color: c.muted,
      fontStyle: 'italic',
      marginTop: 8,
      textAlign: 'center',
    },
    dangerZoneText: {
      fontSize: 14,
      color: c.subtext,
      lineHeight: 20,
      marginBottom: 12,
    },

    modalBody: { gap: 14 },
    modalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    modalIconDanger: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
    modalTitle: { fontSize: 18, fontWeight: '800', color: c.text },
    modalSubtitle: { marginTop: 4, fontSize: 14, color: c.subtext, lineHeight: 20 },
    modalBulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    bulletDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: '#ef4444' },
    modalBulletText: { fontSize: 14, color: c.text, flex: 1, lineHeight: 20 },
  });
}
