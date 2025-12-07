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
  const isAdmin = staffProfile?.role === 'admin';
  const canChangeRoles = ['admin', 'manager', 'chef'].includes(staffProfile?.role ?? '');
  const dayRoles = ['waiter', 'chef', 'manager', 'sommelier', 'bartender', 'host', 'runner', 'barista', 'cashier'];
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
  const [newDayRole, setNewDayRole] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<{ url: string; name: string } | null>(null);
  const [viewUser, setViewUser] = useState<StaffProfile | null>(null);
  const [viewDayRole, setViewDayRole] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    setViewDayRole(viewUser?.day_role ?? null);
  }, [viewUser]);

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
    Alert.alert('Roles are fixed', 'Default roles are immutable (admin or staff only). Use day roles for shift duties.');
    return;
  }

  async function changeDayRole(target: StaffProfile, nextDayRole: string | null) {
    if (!staffProfile) return;
    if (target.id === staffProfile.id && staffProfile.role !== 'admin' && staffProfile.role !== 'manager') {
      Alert.alert('Action not allowed', 'Only managers or admins can change their own day role here.');
      return;
    }
    setUpdatingId(target.id);
    try {
      const { error } = await supabase.from('staff_profiles').update({ day_role: nextDayRole }).eq('id', target.id);
      if (error) {
        console.warn('update day role error', error);
        Alert.alert('Error', 'Unable to update day role');
      } else {
        if (viewUser?.id === target.id) {
          setViewDayRole(nextDayRole);
          setViewUser({ ...target, day_role: nextDayRole });
        }
        fetchUsers();
      }
    } catch (e) {
      console.warn(e);
      Alert.alert('Error', 'Unable to update day role');
    } finally {
      setUpdatingId(null);
    }
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
        email: newEmail,
        role: newRole,
        day_role: newDayRole,
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
      setNewDayRole(null);
      fetchUsers();
    } catch (e) {
      console.warn('add user exception', e);
      Alert.alert('Error', (e as Error)?.message ?? 'Unable to create user');
    } finally {
      setCreating(false);
    }
  }

  if (!canChangeRoles) {
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
                    <Text style={styles.small}>{item.phone ?? item.email ?? item.id}</Text>
                    {item.day_role ? <Text style={styles.dayRoleTag}>Day role: {item.day_role}</Text> : null}
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
              <Pressable style={styles.row} onPress={() => setViewUser(item)}>
                <Pressable onPress={() => item.avatar_url && setSelectedAvatar({ url: item.avatar_url, name: item.name || item.id })}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={[styles.avatar, item.role === 'admin' ? styles.adminAvatar : null]} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, item.role === 'admin' ? styles.adminAvatar : null]}><Text style={styles.avatarInitials}>{(item.name || item.id).slice(0,2).toUpperCase()}</Text></View>
                  )}
                </Pressable>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{item.name || item.id}</Text>
                  <Text style={styles.small}>{item.phone ?? item.email ?? item.id}</Text>
                  {item.day_role ? <Text style={styles.dayRoleTag}>Day role: {item.day_role}</Text> : null}
                </View>
                <View style={styles.roleReadOnly}>
                  <Text style={styles.roleReadOnlyText}>{item.role?.toUpperCase()}</Text>
                </View>
              </Pressable>
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
              <Text style={styles.label}>Default Role (immutable):</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Pressable
                  style={[styles.roleBtn, newRole === 'staff' ? styles.roleBtnSelected : styles.roleBtnUnselected]}
                  onPress={() => setNewRole('staff')}
                >
                  <Text style={[styles.roleText, newRole === 'staff' ? styles.roleTextSelected : null]}>Staff</Text>
                </Pressable>
                {isAdmin && (
                  <Pressable
                    style={[styles.roleBtn, newRole === 'admin' ? styles.roleBtnSelected : styles.roleBtnUnselected]}
                    onPress={() => setNewRole('admin')}
                  >
                    <Text style={[styles.roleText, newRole === 'admin' ? styles.roleTextSelected : null]}>Admin</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.roleSelector}>
              <Text style={styles.label}>Day Role (shift):</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {dayRoles.map((r) => (
                  <Pressable
                    key={r}
                    style={[styles.roleBtn, newDayRole === r ? styles.roleBtnSelected : styles.roleBtnUnselected]}
                    onPress={() => setNewDayRole(r)}
                  >
                    <Text style={[styles.roleText, newDayRole === r ? styles.roleTextSelected : null]}>{r.toUpperCase()}</Text>
                  </Pressable>
                ))}
                <Pressable
                  style={[styles.roleBtn, newDayRole === null ? styles.roleBtnSelected : styles.roleBtnUnselected]}
                  onPress={() => setNewDayRole(null)}
                >
                  <Text style={[styles.roleText, newDayRole === null ? styles.roleTextSelected : null]}>NONE</Text>
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

      {/* User Detail Modal */}
      <Modal visible={viewUser !== null} transparent animationType="fade" onRequestClose={() => setViewUser(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.viewModalBox}>
            <View style={styles.viewModalHeader}>
              <Text style={styles.viewModalTitle}>User Details</Text>
              <Pressable style={styles.viewClose} onPress={() => setViewUser(null)}>
                <Text style={styles.viewCloseText}>✕</Text>
              </Pressable>
            </View>

            {viewUser && (
              <View style={{ gap: 14 }}>
                <View style={{ alignItems: 'center', gap: 10 }}>
                  {viewUser.avatar_url ? (
                    <Image source={{ uri: viewUser.avatar_url }} style={styles.viewAvatar} />
                  ) : (
                    <View style={styles.viewAvatarPlaceholder}>
                      <Text style={styles.viewAvatarInitials}>{(viewUser.name || viewUser.id).slice(0,2).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.viewRoleChip}><Text style={styles.viewRoleChipText}>{viewUser.role?.toUpperCase()}</Text></View>
                </View>

                <View style={styles.viewFieldRow}>
                  <Text style={styles.viewLabel}>Name</Text>
                  <Text style={styles.viewValue}>{viewUser.name || 'N/A'}</Text>
                </View>
                <View style={styles.viewFieldRow}>
                  <Text style={styles.viewLabel}>Phone</Text>
                  <Text style={styles.viewValue}>{viewUser.phone || 'N/A'}</Text>
                </View>
                <View style={styles.viewFieldRow}>
                  <Text style={styles.viewLabel}>Email</Text>
                  <Text style={styles.viewValue}>{viewUser.email || 'N/A'}</Text>
                </View>
                <View style={styles.viewFieldRow}>
                  <Text style={styles.viewLabel}>User ID</Text>
                  <Text style={styles.viewValue}>{viewUser.id}</Text>
                </View>

                <View style={{ gap: 10 }}>
                  <Text style={styles.viewLabel}>Default Role</Text>
                  <View style={styles.roleReadOnly}>
                    <Text style={styles.roleReadOnlyText}>{viewUser.role?.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={{ gap: 10 }}>
                  <Text style={styles.viewLabel}>Day Role (shift)</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {dayRoles.map((r) => (
                      <Pressable
                        key={r}
                        style={[styles.roleBtn, viewDayRole === r ? styles.roleBtnSelected : styles.roleBtnUnselected]}
                        onPress={() => viewUser && changeDayRole(viewUser, r)}
                        disabled={updatingId === viewUser?.id}
                      >
                        <Text style={[styles.roleText, viewDayRole === r ? styles.roleTextSelected : null]}>{r.toUpperCase()}</Text>
                      </Pressable>
                    ))}
                    <Pressable
                      style={[styles.roleBtn, viewDayRole === null ? styles.roleBtnSelected : styles.roleBtnUnselected]}
                      onPress={() => viewUser && changeDayRole(viewUser, null)}
                      disabled={updatingId === viewUser?.id}
                    >
                      <Text style={[styles.roleText, viewDayRole === null ? styles.roleTextSelected : null]}>NONE</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
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
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.card, marginBottom: 10 },
    avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: c.border },
    avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.input, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border },
    avatarInitials: { color: c.subtext, fontWeight: '700', fontSize: 16 },
    name: { fontSize: 16, fontWeight: '700', color: c.text },
    small: { color: c.muted, fontSize: 12 },
    dayRoleTag: { color: c.primary, fontSize: 12, fontWeight: '700', marginTop: 2 },
    roleBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', alignItems: 'center', borderWidth: 1, minWidth: 74 },
    roleBtnSelected: { backgroundColor: c.primary, borderColor: c.primary },
    roleBtnUnselected: { backgroundColor: c.input, borderColor: c.border },
    roleText: { fontWeight: '700', color: c.text },
    roleTextSelected: { color: '#fff' },
    adminAvatar: { borderWidth: 2, borderColor: c.primary },
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
    viewModalBox: { width: '90%', maxWidth: 420, backgroundColor: c.card, borderRadius: 16, padding: 24, gap: 12 },
    viewModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    viewModalTitle: { fontSize: 18, fontWeight: '800', color: c.text },
    viewClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.input, alignItems: 'center', justifyContent: 'center' },
    viewCloseText: { fontSize: 18, fontWeight: '800', color: c.text },
    viewAvatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: c.border },
    viewAvatarPlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: c.input, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.border },
    viewAvatarInitials: { fontSize: 36, fontWeight: '800', color: c.subtext },
    viewRoleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: c.primary },
    viewRoleChipText: { color: '#fff', fontWeight: '700', letterSpacing: 0.5 },
    viewFieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
    viewLabel: { color: c.muted, fontWeight: '600', fontSize: 14 },
    viewValue: { color: c.text, fontWeight: '700', fontSize: 15 },
  });
}


