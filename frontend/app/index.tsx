import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../src/theme';

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const userId = await AsyncStorage.getItem('user_id');
      if (userId) {
        router.replace('/(tabs)');
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <View style={styles.iconCircle}>
          <Ionicons name="leaf" size={48} color={COLORS.primary} />
        </View>
        <Text style={styles.appName}>NutriAI</Text>
        <Text style={styles.tagline}>Kişisel Diyet & Fitness Asistanın</Text>
      </View>

      <View style={styles.features}>
        {[
          { icon: 'body-outline', text: 'Kişisel diyet planı' },
          { icon: 'camera-outline', text: 'Fotoğraftan kalori analizi' },
          { icon: 'fitness-outline', text: 'Egzersiz takibi' },
          { icon: 'trophy-outline', text: 'Motivasyon ve başarılar' },
        ].map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon as any} size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        testID="get-started-btn"
        style={styles.startButton}
        onPress={() => router.push('/onboarding')}
        activeOpacity={0.8}
      >
        <Text style={styles.startButtonText}>Başlayalım</Text>
        <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
    paddingTop: 80,
    paddingBottom: 50,
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'center',
    marginTop: SPACING.xxl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  appName: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '300',
    color: COLORS.textPrimary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  features: {
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  featureText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  startButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: RADIUS.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  startButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
  },
});
