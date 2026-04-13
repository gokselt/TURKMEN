import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../../src/theme';
import { api } from '../../src/api';

export default function DietScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [foods, setFoods] = useState<any[]>([]);
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMealType, setSelectedMealType] = useState('Kahvaltı');

  useEffect(() => {
    loadUserId();
  }, []);

  const loadUserId = async () => {
    const id = await AsyncStorage.getItem('user_id');
    setUserId(id);
    if (id) loadPlan(id);
  };

  const loadPlan = async (id: string) => {
    try {
      const res = await api.getDietPlan(id);
      if (res.has_plan) {
        setPlan(res);
        setHasPlan(true);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const generatePlan = async () => {
    if (!userId) return;
    setGenerating(true);
    try {
      const res = await api.generateDiet(userId);
      setPlan({ ...res, has_plan: true });
      setHasPlan(true);
    } catch (err) { console.error(err); }
    finally { setGenerating(false); }
  };

  const searchFoods = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 1) { setFoods([]); return; }
    try {
      const res = await api.getFoods(q);
      setFoods(res);
    } catch (err) { console.error(err); }
  };

  const logFood = async (food: any) => {
    if (!userId) return;
    try {
      await api.logMeal({
        user_id: userId,
        food_name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        serving_size: food.serving_size,
        meal_type: selectedMealType,
      });
      setShowFoodModal(false);
      setSearchQuery('');
      setFoods([]);
    } catch (err) { console.error(err); }
  };

  const onRefresh = useCallback(() => { if (userId) { setRefreshing(true); loadPlan(userId); } }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  const currentDay = plan?.daily_plans?.[selectedDay];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Diyet Planı</Text>
        <TouchableOpacity testID="add-meal-btn" style={styles.addBtn} onPress={() => setShowFoodModal(true)}>
          <Ionicons name="add" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {!hasPlan ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.border} />
            </View>
            <Text style={styles.emptyTitle}>Henüz diyet planınız yok</Text>
            <Text style={styles.emptyDesc}>AI destekli kişisel diyet planınızı oluşturun</Text>
            <TouchableOpacity testID="generate-plan-btn" style={styles.generateBtn} onPress={generatePlan} disabled={generating}>
              {generating ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={20} color={COLORS.white} />
                  <Text style={styles.generateBtnText}>Plan Oluştur</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{plan?.plan_name || 'Kişisel Diyet Planı'}</Text>
              <Text style={styles.planDesc}>{plan?.description || ''}</Text>
              <TouchableOpacity testID="regenerate-btn" style={styles.regenBtn} onPress={generatePlan} disabled={generating}>
                {generating ? <ActivityIndicator size="small" color={COLORS.primary} /> : (
                  <><Ionicons name="refresh" size={16} color={COLORS.primary} /><Text style={styles.regenText}> Yenile</Text></>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs}>
              {plan?.daily_plans?.map((d: any, i: number) => (
                <TouchableOpacity
                  testID={`day-tab-${i}`}
                  key={i}
                  style={[styles.dayTab, selectedDay === i && styles.dayTabActive]}
                  onPress={() => setSelectedDay(i)}
                >
                  <Text style={[styles.dayTabNum, selectedDay === i && styles.dayTabNumActive]}>
                    Gün {d.day}
                  </Text>
                  <Text style={[styles.dayTabName, selectedDay === i && styles.dayTabNameActive]}>
                    {d.day_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {currentDay?.meals?.map((meal: any, i: number) => (
              <View key={i} style={styles.mealCard}>
                <View style={styles.mealHeader}>
                  <Text style={styles.mealType}>{meal.meal_type}</Text>
                  <Text style={styles.mealCalories}>{meal.total_calories} kcal</Text>
                </View>
                {meal.foods?.map((food: string, j: number) => (
                  <View key={j} style={styles.foodItem}>
                    <Ionicons name="ellipse" size={6} color={COLORS.secondary} />
                    <Text style={styles.foodText}>{food}</Text>
                  </View>
                ))}
                <View style={styles.mealMacros}>
                  <Text style={styles.macroTag}>P: {meal.protein}g</Text>
                  <Text style={styles.macroTag}>K: {meal.carbs}g</Text>
                  <Text style={styles.macroTag}>Y: {meal.fat}g</Text>
                </View>
              </View>
            ))}

            {currentDay?.tip && (
              <View style={styles.tipCard}>
                <Ionicons name="bulb-outline" size={20} color={COLORS.primary} />
                <Text style={styles.tipText}>{currentDay.tip}</Text>
              </View>
            )}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal visible={showFoodModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Öğün Kaydet</Text>
              <TouchableOpacity testID="close-food-modal" onPress={() => setShowFoodModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.mealTypePicker}>
              {['Kahvaltı', 'Öğle', 'Akşam', 'Ara Öğün'].map((t) => (
                <TouchableOpacity
                  testID={`meal-type-${t}`}
                  key={t}
                  style={[styles.mealTypeBtn, selectedMealType === t && styles.mealTypeBtnActive]}
                  onPress={() => setSelectedMealType(t)}
                >
                  <Text style={[styles.mealTypeText, selectedMealType === t && styles.mealTypeTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              testID="food-search-input"
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={searchFoods}
              placeholder="Yemek ara..."
              placeholderTextColor={COLORS.textSecondary}
            />

            <ScrollView style={styles.foodList}>
              {foods.map((food, i) => (
                <TouchableOpacity testID={`food-item-${i}`} key={i} style={styles.foodListItem} onPress={() => logFood(food)}>
                  <View style={styles.foodListInfo}>
                    <Text style={styles.foodListName}>{food.name}</Text>
                    <Text style={styles.foodListServing}>{food.serving_size}</Text>
                  </View>
                  <View style={styles.foodListCal}>
                    <Text style={styles.foodListCalText}>{food.calories}</Text>
                    <Text style={styles.foodListCalLabel}>kcal</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
  },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '300', color: COLORS.textPrimary, letterSpacing: -0.5 },
  addBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: SPACING.xl },
  emptyIcon: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.lg,
  },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.textPrimary },
  emptyDesc: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: SPACING.sm, textAlign: 'center' },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl, marginTop: SPACING.lg,
  },
  generateBtnText: { color: COLORS.white, fontSize: FONT_SIZE.md, fontWeight: '600' },
  planHeader: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
  planName: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.textPrimary },
  planDesc: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4 },
  regenBtn: {
    flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm,
    alignSelf: 'flex-start', padding: SPACING.sm, borderRadius: RADIUS.sm,
  },
  regenText: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '600' },
  dayTabs: { paddingLeft: SPACING.lg, marginBottom: SPACING.md },
  dayTab: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, marginRight: SPACING.sm,
    borderRadius: RADIUS.lg, backgroundColor: COLORS.surfaceAlt, alignItems: 'center',
  },
  dayTabActive: { backgroundColor: COLORS.primary },
  dayTabNum: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textPrimary },
  dayTabNumActive: { color: COLORS.white },
  dayTabName: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  dayTabNameActive: { color: COLORS.white + 'CC' },
  mealCard: {
    marginHorizontal: SPACING.lg, marginBottom: SPACING.md, padding: SPACING.md,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
  },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  mealType: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary },
  mealCalories: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.primary },
  foodItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 3 },
  foodText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, flex: 1 },
  mealMacros: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  macroTag: {
    fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.sm,
  },
  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    marginHorizontal: SPACING.lg, padding: SPACING.md,
    backgroundColor: COLORS.primary + '08', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.primary + '20',
  },
  tipText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, lineHeight: 20 },
  modalOverlay: {
    flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: 40, maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md,
  },
  modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.textPrimary },
  mealTypePicker: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  mealTypeBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceAlt,
  },
  mealTypeBtnActive: { backgroundColor: COLORS.primary },
  mealTypeText: { fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  mealTypeTextActive: { color: COLORS.white, fontWeight: '600' },
  searchInput: {
    backgroundColor: COLORS.surfaceAlt, height: 48, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, fontSize: FONT_SIZE.md, color: COLORS.textPrimary,
  },
  foodList: { marginTop: SPACING.md },
  foodListItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceAlt,
  },
  foodListInfo: { flex: 1 },
  foodListName: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary, fontWeight: '500' },
  foodListServing: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  foodListCal: { alignItems: 'center' },
  foodListCalText: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.primary },
  foodListCalLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
});
