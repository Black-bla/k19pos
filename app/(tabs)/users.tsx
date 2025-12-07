import Screen from '@/components/Screen';
import { showToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { StaffProfile } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function UsersScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { staffProfile } = useAuth();
  const [users, setUsers] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('staff');
  const [creating, setCreating] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.from('staff_profiles').select('*').order('name', { ascending: true });
      if (error) {
        console.warn('fetch users error', error);
        setErrorMsg(error.message || 'Unable to load users');
        Alert.alert('Error', error.message || 'Unable to load users');
        setUsers([]);
        return;
      }
      setUsers((data as StaffProfile[]) || []);
    } catch (e) {
      console.warn('fetch users exception', e);
      setErrorMsg((e as Error)?.message ?? 'Unable to load users');
      Alert.alert('Error', (e as Error)?.message ?? 'Unable to load users');
    } finally {
      setLoading(false);
    }
  }

  async function changeRole(target: StaffProfile, newRole: string) {
    if (!staffProfile) return;
    if (target.id === staffProfile.id) {
      Alert.alert('Action not allowed', 'You cannot change your own role here.');
      return;
    }
    if (target.role === 'admin') {
      Alert.alert('Action not allowed', 'The admin role cannot be changed.');
      return;
    }
    Alert.alert('Confirm role change', `Change ${target.name || target.id} to ${newRole}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          setUpdatingId(target.id);
          try {
            const { error } = await supabase.from('staff_profiles').update({ role: newRole }).eq('id', target.id);
            if (error) {
              console.warn('update role error', error);
              Alert.alert('Error', 'Unable to update role');
            } else {
              fetchUsers();
            }
          } catch (e) {
            console.warn(e);
            Alert.alert('Error', 'Unable to update role');
          } finally {
            setUpdatingId(null);
          }
        }
      }
    ]);
  }

  async function handleAddUser() {
    if (!newEmail.trim() || !newPassword.trim() || !newName.trim()) {
      Alert.alert('Missing fields', 'Please fill in email, password, and name.');
      return;
    }
    setCreating(true);
    try {
      // Use signUp to create the user (requires user to have service role or enable public signups)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: {
          data: { full_name: newName }
        }
      });

      if (authError) {
        console.warn('create user error', authError);
        Alert.alert('Error', authError.message || 'Unable to create user');
        setCreating(false);
        return;
      }

      const userId = authData?.user?.id;
      if (!userId) {
        Alert.alert('Error', 'User created but no ID returned');
        setCreating(false);
        return;
      }

      // Create staff profile with the specified role (override default)
      const { error: profileError } = await supabase.from('staff_profiles').upsert({
        id: userId,
        name: newName,
        phone: newPhone || null,
        role: newRole,
      });

      if (profileError) {
        console.warn('create profile error', profileError);
        showToast('User created but profile setup failed: ' + profileError.message, 'warning', 4000, 'card');
      } else {
        showToast('User created successfully. They should check their email to confirm their account.', 'success', 4000, 'card');
      }

      setAddModalOpen(false);
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewPhone('');
      setNewRole('staff');
      fetchUsers();
    } catch (e) {
      console.warn('add user exception', e);
      Alert.alert('Error', (e as Error)?.message ?? 'Unable to create user');
    } finally {
      setCreating(false);
    }
  }

  if (staffProfile?.role !== 'admin' && staffProfile?.role !== 'manager') {
    return (
      <Screen style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.push('/(tabs)/profile')} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
          </Pressable>
          <Text style={styles.title}>Users</Text>
          <View style={styles.backButtonPlaceholder} />
        </View>
        <View style={{ padding: 16, flex: 1 }}>
          {loading ? (
            <ActivityIndicator />
          ) : errorMsg ? (
            <View style={{ alignItems: 'center', marginTop: 24 }}>
              <Text style={{ color: '#ef4444' }}>Error loading users</Text>
              <Text style={{ color: '#9ca3af', marginTop: 8 }}>{errorMsg}</Text>
            </View>
          ) : users.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 24 }}>
              <Text style={{ color: '#6b7280' }}>No users found.</Text>
            </View>
          ) : (
            <FlatList
              data={users}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <Pressable onPress={() => item.avatar_url && setSelectedAvatar({ url: item.avatar_url, name: item.name || item.id })}>
                    {item.avatar_url ? (
                      <Image source={{ uri: item.avatar_url }} style={[styles.avatar, item.role === 'admin' ? styles.adminAvatar : null]} />
                    ) : (
                      <View style={[styles.avatarPlaceholder, item.role === 'admin' ? styles.adminAvatar : null]}>
                        <Text style={styles.avatarInitials}>{(item.name || item.id).slice(0,2).toUpperCase()}</Text>
                      </View>
                    )}
                  </Pressable>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.name}>{item.name || item.id}</Text>
                    <Text style={styles.small}>{item.phone ?? item.id}</Text>
                  </View>
                  <View style={styles.roleReadOnly}>
                    <Text style={styles.roleReadOnlyText}>{item.role?.toUpperCase()}</Text>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/(tabs)/profile')} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
        </Pressable>
        <Text style={styles.title}>Manage Users</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>
      <View style={{ padding: 16, flex: 1 }}>
        <Pressable style={styles.addBtn} onPress={() => setAddModalOpen(true)}>
          <Text style={styles.addText}>+ Add User</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator />
        ) : errorMsg ? (
          <View style={{ alignItems: 'center', marginTop: 24 }}>
            <Text style={{ color: '#ef4444' }}>Error loading users</Text>
            <Text style={{ color: '#9ca3af', marginTop: 8 }}>{errorMsg}</Text>
          </View>
        ) : users.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 24 }}>
            <Text style={{ color: '#6b7280' }}>No users found.</Text>
            <Text style={{ color: '#9ca3af', marginTop: 8 }}>Ensure `staff_profiles` contains rows and RLS allows reads for this key.</Text>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Pressable onPress={() => item.avatar_url && setSelectedAvatar({ url: item.avatar_url, name: item.name || item.id })}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={[styles.avatar, item.role === 'admin' ? styles.adminAvatar : null]} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, item.role === 'admin' ? styles.adminAvatar : null]}><Text style={styles.avatarInitials}>{(item.name || item.id).slice(0,2).toUpperCase()}</Text></View>
                  )}
                </Pressable>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{item.name || item.id}</Text>
                  <Text style={styles.small}>{item.phone ?? item.id}</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={[styles.roleBtn, { backgroundColor: item.role === 'manager' ? '#fde68a' : '#f3f4f6' }]}
                      onPress={() => changeRole(item, 'manager')}
                      disabled={updatingId === item.id || item.role === 'admin'}
                    >
                      <Text style={styles.roleText}>Manager</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.roleBtn, { backgroundColor: item.role === 'chef' ? '#fcd34d' : '#f3f4f6' }]}
                      onPress={() => changeRole(item, 'chef')}
                      disabled={updatingId === item.id || item.role === 'admin'}
                    >
                      <Text style={styles.roleText}>Chef</Text>
                    </Pressable>
                </View>
              </View>
            )}
          />
        )}
      </View>

      {/* Add User Modal */}
      <Modal visible={addModalOpen} transparent animationType="fade" onRequestClose={() => setAddModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add New User</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={newName}
              onChangeText={setNewName}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Phone (optional)"
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
            />

            <View style={styles.roleSelector}>
              <Text style={styles.label}>Role:</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  style={[styles.roleBtn, { backgroundColor: newRole === 'staff' ? '#10b981' : '#f3f4f6' }]}
                  onPress={() => setNewRole('staff')}
                >
                  <Text style={[styles.roleText, { color: newRole === 'staff' ? '#fff' : '#111827' }]}>Staff</Text>
                </Pressable>
                <Pressable
                  style={[styles.roleBtn, { backgroundColor: newRole === 'chef' ? '#fcd34d' : '#f3f4f6' }]}
                  onPress={() => setNewRole('chef')}
                >
                  <Text style={styles.roleText}>Chef</Text>
                </Pressable>
                <Pressable
                  style={[styles.roleBtn, { backgroundColor: newRole === 'manager' ? '#fde68a' : '#f3f4f6' }]}
                  onPress={() => setNewRole('manager')}
                >
                  <Text style={styles.roleText}>Manager</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setAddModalOpen(false)} disabled={creating}>
                <Text style={styles.btnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.createBtn} onPress={handleAddUser} disabled={creating}>
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fullscreen Avatar Viewer */}
      <Modal visible={selectedAvatar !== null} transparent animationType="fade" onRequestClose={() => setSelectedAvatar(null)}>
        <Pressable style={styles.fullscreenAvatarOverlay} onPress={() => setSelectedAvatar(null)}>
          <View style={styles.fullscreenAvatarContainer}>
            <Pressable style={styles.closeButton} onPress={() => setSelectedAvatar(null)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
            {selectedAvatar && (
              <>
                <Image source={{ uri: selectedAvatar.url }} style={styles.fullscreenAvatar} />
                <Text style={styles.avatarName}>{selectedAvatar.name}</Text>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function createStyles(theme: any) {
  const c = theme.colors;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { padding: 20, paddingTop: 60, backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backButton: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    backButtonPlaceholder: { width: 40 },
    title: { fontSize: 22, fontWeight: '700', color: c.text, flex: 1, textAlign: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: c.border },
    avatar: { width: 64, height: 64, borderRadius: 32 },
    avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.border, alignItems: 'center', justifyContent: 'center' },
    avatarInitials: { color: c.subtext, fontWeight: '700', fontSize: 16 },
    name: { fontSize: 16, fontWeight: '700', color: c.text },
    small: { color: c.muted, fontSize: 12 },
    roleBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: c.border, minWidth: 74 },
    roleText: { fontWeight: '700', color: c.text },
    adminAvatar: { borderWidth: 3, borderColor: c.text },
    addBtn: { backgroundColor: c.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
    addText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', alignItems: 'center' },
    modalBox: { width: '90%', maxWidth: 400, backgroundColor: c.card, borderRadius: 16, padding: 24 },
    modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: c.text },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, backgroundColor: c.input, color: c.text },
    roleSelector: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: c.subtext, marginBottom: 8 },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    cancelBtn: { flex: 1, backgroundColor: c.muted, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    createBtn: { flex: 1, backgroundColor: c.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    roleReadOnly: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: c.input,
    },
    roleReadOnlyText: {
      fontSize: 12,
      fontWeight: '600',
      color: c.subtext,
    },
    // Fullscreen Avatar Viewer
    fullscreenAvatarOverlay: {
      flex: 1,
      backgroundColor: '#000000',
      justifyContent: 'center',
      alignItems: 'center',
    },
    fullscreenAvatarContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    fullscreenAvatar: {
      width: '90%',
      maxWidth: 500,
      aspectRatio: 1,
      borderRadius: 20,
      resizeMode: 'cover',
    },
    avatarName: {
      fontSize: 18,
      fontWeight: '700',
      color: '#fff',
      marginTop: 20,
      textAlign: 'center',
    },
    closeButton: {
      position: 'absolute',
      top: 40,
      right: 20,
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    closeButtonText: {
      fontSize: 28,
      color: '#fff',
      fontWeight: '700',
    },
  });
}


