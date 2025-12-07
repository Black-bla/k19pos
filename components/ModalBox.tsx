import { useTheme } from '@/context/ThemeContext';
import React, { ReactNode, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  cancelLabel?: string;
  showFooter?: boolean;
  scrollable?: boolean;
}

export default function ModalBox({
  title,
  subtitle,
  children,
  onClose,
  onConfirm,
  confirmLabel = 'Confirm',
  confirmDisabled = false,
  cancelLabel = 'Cancel',
  showFooter = true,
  scrollable = true,
}: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const contentInner = (
    <>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {children}
      </View>

      {showFooter && (
        <View style={styles.footer}>
          <Pressable 
            style={[styles.btn, styles.cancelBtn]} 
            onPress={onClose}
          >
            <Text style={styles.cancelBtnText}>{cancelLabel}</Text>
          </Pressable>
          {onConfirm && (
            <Pressable 
              style={[styles.btn, styles.confirmBtn, confirmDisabled && styles.confirmBtnDisabled]} 
              onPress={onConfirm}
              disabled={confirmDisabled}
            >
              <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
            </Pressable>
          )}
        </View>
      )}
    </>
  );

  if (scrollable) {
    return (
      <View style={styles.overlay}>
        <View style={styles.box}>
          <ScrollView 
            style={styles.scrollableContent}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {contentInner}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.box}>
        {contentInner}
      </View>
    </View>
  );
}

function createStyles(theme: any) {
  const c = theme.colors;
  return StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 20,
    },
    scrollableContent: {
      flexGrow: 1,
    },
    box: {
      width: '90%',
      maxWidth: 520,
      maxHeight: '85%',
      backgroundColor: c.card,
      borderRadius: 20,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: theme.isDark ? 0.4 : 0.15,
      shadowRadius: 12,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: 28,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 13,
      color: c.subtext,
      marginTop: 6,
      fontWeight: '500',
    },
    closeBtn: {
      padding: 8,
      marginRight: -8,
      marginTop: -4,
    },
    closeText: {
      color: c.muted,
      fontSize: 20,
      fontWeight: '600',
    },
    content: {
      paddingHorizontal: 28,
      paddingVertical: 20,
      flexShrink: 1,
    },
    footer: {
      flexDirection: 'row',
      gap: 14,
      padding: 28,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    btn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtn: {
      backgroundColor: c.input,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    cancelBtnText: {
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
    },
    confirmBtn: {
      backgroundColor: c.success,
      shadowColor: c.success,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    confirmBtnDisabled: {
      opacity: 0.6,
    },
    confirmBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
