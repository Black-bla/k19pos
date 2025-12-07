import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';

export type ToastType = 'success' | 'error' | 'info' | 'warning';
export type ToastStyle = 'toast' | 'card';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  style?: ToastStyle;
  persistent?: boolean;
}

// Global state for toasts
let toastListeners: Array<(toasts: ToastMessage[]) => void> = [];
let toastQueue: ToastMessage[] = [];
const logo = require('../assets/images/k19pos-logo.png');

export function showToast(message: string, type: ToastType = 'info', duration: number = 3000, style: ToastStyle = 'toast', persistent: boolean = false) {
  const id = Date.now().toString() + Math.random();
  const toast: ToastMessage = { id, message, type, duration: persistent ? 0 : duration, style, persistent };
  toastQueue.push(toast);
  notifyListeners();

  if (!persistent && duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }

  return id;
}

export function dismissToast(id: string) {
  toastQueue = toastQueue.filter((t) => t.id !== id);
  notifyListeners();
}

export function updateToast(id: string, updates: Partial<ToastMessage>) {
  const toastIndex = toastQueue.findIndex((t) => t.id === id);
  if (toastIndex !== -1) {
    toastQueue[toastIndex] = { ...toastQueue[toastIndex], ...updates };
    notifyListeners();
  }
}

function notifyListeners() {
  toastListeners.forEach((listener) => listener([...toastQueue]));
}

function subscribe(listener: (toasts: ToastMessage[]) => void) {
  toastListeners.push(listener);
  return () => {
    toastListeners = toastListeners.filter((l) => l !== listener);
  };
}

export default function Toast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe(setToasts);
    return unsubscribe;
  }, []);

  return (
    <View style={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </View>
  );
}

function ToastItem({ toast }: { toast: ToastMessage }) {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (toast.persistent) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(toast.duration ? toast.duration - 600 : 2400),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [toast.persistent, toast.duration]);

  const getColors = () => {
    switch (toast.type) {
      case 'success':
        return { bg: '#10b981', icon: 'checkmark-circle', color: '#fff' };
      case 'error':
        return { bg: '#ef4444', icon: 'close-circle', color: '#fff' };
      case 'warning':
        return { bg: '#f59e0b', icon: 'warning', color: '#fff' };
      case 'info':
      default:
        return { bg: '#3b82f6', icon: 'information-circle', color: '#fff' };
    }
  };

  const { bg, icon, color } = getColors();

  if (toast.style === 'card') {
    return (
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        <Image source={logo} style={styles.cardLogo} resizeMode="contain" />
        <View style={styles.cardBody}>
          <View style={[styles.cardIconContainer, { backgroundColor: bg }]}>
            <Ionicons name={icon as any} size={24} color={color} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardMessage}>{toast.message}</Text>
          </View>
          {toast.persistent && (
            <Pressable onPress={() => dismissToast(toast.id)} style={styles.dismissButton}>
              <Ionicons name="close" size={20} color="#6b7280" />
            </Pressable>
          )}
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity: fadeAnim }]}>
      <Image source={logo} style={styles.toastLogo} resizeMode="contain" />
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[styles.toastText, { color }]}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  toastLogo: {
    width: 80,
    height: 20,
    marginRight: 8,
  },
  card: {
    flexDirection: 'column',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  cardLogo: {
    width: 140,
    height: 36,
    alignSelf: 'center',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cardIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 22,
  },
  dismissButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
