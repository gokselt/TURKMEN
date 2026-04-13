import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../../src/theme';
import { api } from '../../src/api';

export default function HomeScreen() {
  const [user, setUser] = useState<any>(null);
  const [todayMeals, setTodayMeals] = useState<any>(null);
  const [todayExercises, setTodayExercises] = useState<any>(null);
  const [motivation, setMotivation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const userId = await AsyncStorage.getItem('user_id');
      if (!userId) return;
      const [u, m, e, mot] = await Promise.all([
        api.getUser(userId),
        api.getTodayMeals(userId),
        api.getTodayExercises(userId),
        api.getMotivation(userId),
      ]);
      setUser(u);
      setTodayMeals(m);
      setTodayExercises(e);
      setMotivation(mot);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  const caloriesConsumed = todayMeals?.totals?.calories || 0;
  const caloriesTarget = user?.daily_calorie_target || 2000;
  const caloriesBurned = todayExercises?.total_burned || 0;
  const caloriesRemaining = Math.max(0, caloriesTarget - caloriesConsumed + caloriesBurned);
  const progress = Math.min(1, caloriesConsumed / caloriesTarget);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Merhaba,</Text>
            <Text style={styles.userName}>{user?.name || 'Kullanıcı'}</Text>
          </View>
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={18} color={COLORS.primary} />
            <Text style={styles.streakText}>{motivation?.stats?.total_meals || 0}</Text>
          </View>
        </View>

        {motivation?.motivational_message && (
          <View style={styles.motivationCard}>
            <Ionicons name="sparkles" size={20} color={COLORS.primary} />
            <Text style={styles.motivationText}>{motivation.motivational_message}</Text>
          </View>
        )}

        <View style={styles.calorieCard}>
          <Text style={styles.calorieTitle}>Günlük Kalori</Text>
          <View style={styles.calorieCircle}>
            <View style={[styles.progressRing, { transform: [{ rotate: `${progress * 360}deg` }] }]} />
            <View style={styles.calorieInner}>
              <Text style={styles.calorieNumber}>{caloriesRemaining}</Text>
              <Text style={styles.calorieLabel}>kalan kcal</Text>
            </View>
          </View>
          <View style={styles.macroRow}>
            <MacroItem label="Alınan" value={`${caloriesConsumed}`} color={COLORS.primary} icon="flame-outline" />
            <MacroItem label="Hedef" value={`${caloriesTarget}`} color={COLORS.secondary} icon="flag-outline" />
            <MacroItem label="Yakılan" value={`${caloriesBurned}`} color="#4CAF50" icon="fitness-outline" />
          </View>
        </View>

        <View style={styles.macrosCard}>
          <Text style={styles.sectionTitle}>Makrolar</Text>
          <View style={styles.macroBarRow}>
            <MacroBar label="Protein" current={todayMeals?.totals?.protein || 0} target={user?.daily_protein || 100} color={COLORS.primary} />
            <MacroBar label="Karbonhidrat" current={todayMeals?.totals?.carbs || 0} target={user?.daily_carbs || 200} color={COLORS.secondary} />
            <MacroBar label="Yağ" current={todayMeals?.totals?.fat || 0} target={user?.daily_fat || 60} color="#FFA726" />
          </View>
        </View>

        {motivation?.surprises && motivation.surprises.length > 0 && (
          <View style={styles.surpriseCard}>
            <Ionicons name="gift" size={24} color={COLORS.primary} />
            <Text style={styles.surpriseText}>{motivation.surprises[0].message}</Text>
          </View>
        )}

        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Bugünkü Öğünler</Text>
          {todayMeals?.meals?.length > 0 ? (
            todayMeals.meals.slice(0, 5).map((meal: any, i: number) => (
              <View key={i} style={styles.mealItem}>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealName}>{meal.food_name}</Text>
                  <Text style={styles.mealMeta}>{meal.meal_type} - {meal.serving_size}</Text>
                </View>
                <Text style={styles.mealCal}>{meal.calories} kcal</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={32} color={COLORS.border} />
              <Text style={styles.emptyText}>Henüz öğün kaydedilmedi</Text>
            </View>
          )}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MacroItem({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <View style={styles.macroItem}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={[styles.macroValue, { color }]}>{value}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function MacroBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const pct = Math.min(1, current / Math.max(target, 1));
  return (
    <View style={styles.macroBarItem}>
      <View style={styles.macroBarHeader}>
        <Text style={styles.macroBarLabel}>{label}</Text>
        <Text style={styles.macroBarValue}>{Math.round(current)}/{target}g</Text>
      </View>
      <View style={styles.macroBarBg}>
        <View style={[styles.macroBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
  },
  greeting: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  userName: { fontSize: FONT_SIZE.xl, fontWeight: '300', color: COLORS.textPrimary, letterSpacing: -0.5 },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary + '12',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full,
  },
  streakText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.primary },
  motivationCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.lg, marginTop: SPACING.sm, padding: SPACING.md,
    backgroundColor: COLORS.primary + '08', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.primary + '20',
  },
  motivationText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, lineHeight: 20 },
  calorieCard: {
    margin: SPACING.lg, padding: SPACING.lg, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.md,
  },
  calorieTitle: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  calorieCircle: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.lg },
  progressRing: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 6, borderColor: COLORS.border, borderTopColor: COLORS.primary },
  calorieInner: { alignItems: 'center' },
  calorieNumber: { fontSize: 40, fontWeight: '200', color: COLORS.textPrimary },
  calorieLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: SPACING.md },
  macroItem: { alignItems: 'center', gap: 4 },
  macroValue: { fontSize: FONT_SIZE.lg, fontWeight: '600' },
  macroLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  macrosCard: {
    marginHorizontal: SPACING.lg, padding: SPACING.lg, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border,
  },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.md },
  macroBarRow: { gap: SPACING.md },
  macroBarItem: { gap: 4 },
  macroBarHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  macroBarLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  macroBarValue: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  macroBarBg: { height: 8, backgroundColor: COLORS.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: 4 },
  surpriseCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.lg, marginTop: SPACING.md, padding: SPACING.md,
    backgroundColor: '#FFF3E0', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: '#FFE0B2',
  },
  surpriseText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  recentSection: {
    marginHorizontal: SPACING.lg, marginTop: SPACING.lg, padding: SPACING.lg,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border,
  },
  mealItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceAlt,
  },
  mealInfo: { flex: 1 },
  mealName: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary, fontWeight: '500' },
  mealMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  mealCal: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.primary },
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm },
  emptyText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
});
