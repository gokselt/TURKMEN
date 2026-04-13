import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../src/theme';
import { api } from '../../src/api';

export default function ExerciseScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [todayLog, setTodayLog] = useState<any>(null);
  const [allExercises, setAllExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [duration, setDuration] = useState('30');
  const [logLoading, setLogLoading] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const id = await AsyncStorage.getItem('user_id');
    setUserId(id);
    if (id) loadData(id);
  };

  const loadData = async (id: string) => {
    try {
      const [sug, today, all] = await Promise.all([
        api.getSuggestions(id),
        api.getTodayExercises(id),
        api.getExercises(),
      ]);
      setSuggestions(sug);
      setTodayLog(today);
      setAllExercises(all);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = useCallback(() => { if (userId) { setRefreshing(true); loadData(userId); } }, [userId]);

  const openLog = (exercise: any) => {
    setSelectedExercise(exercise);
    setDuration('30');
    setShowLogModal(true);
  };

  const logExercise = async () => {
    if (!userId || !selectedExercise) return;
    setLogLoading(true);
    try {
      const mins = parseInt(duration) || 30;
      const burned = mins * (selectedExercise.calories_per_min || 5);
      await api.logExercise({
        user_id: userId,
        exercise_name: selectedExercise.name,
        duration_minutes: mins,
        calories_burned: burned,
      });
      setShowLogModal(false);
      loadData(userId);
    } catch (err) { console.error(err); }
    finally { setLogLoading(false); }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Egzersiz</Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.todayCard}>
          <View style={styles.todayRow}>
            <View style={styles.todayStat}>
              <Ionicons name="flame" size={24} color={COLORS.primary} />
              <Text style={styles.todayValue}>{todayLog?.total_burned || 0}</Text>
              <Text style={styles.todayLabel}>kcal yakıldı</Text>
            </View>
            <View style={styles.todayDivider} />
            <View style={styles.todayStat}>
              <Ionicons name="time" size={24} color={COLORS.secondary} />
              <Text style={styles.todayValue}>{todayLog?.total_minutes || 0}</Text>
              <Text style={styles.todayLabel}>dakika</Text>
            </View>
            <View style={styles.todayDivider} />
            <View style={styles.todayStat}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              <Text style={styles.todayValue}>{todayLog?.exercises?.length || 0}</Text>
              <Text style={styles.todayLabel}>egzersiz</Text>
            </View>
          </View>
        </View>

        {todayLog?.exercises?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bugünkü Egzersizler</Text>
            {todayLog.exercises.map((ex: any, i: number) => (
              <View key={i} style={styles.logItem}>
                <View style={styles.logInfo}>
                  <Text style={styles.logName}>{ex.exercise_name}</Text>
                  <Text style={styles.logMeta}>{ex.duration_minutes} dk</Text>
                </View>
                <Text style={styles.logCal}>{ex.calories_burned} kcal</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sana Özel Öneriler</Text>
          {suggestions.map((ex, i) => (
            <TouchableOpacity testID={`suggestion-${i}`} key={i} style={styles.exerciseCard} onPress={() => openLog(ex)}>
              <View style={[styles.exerciseIcon, { backgroundColor: getTypeColor(ex.type) + '15' }]}>
                <Ionicons name={getTypeIcon(ex.type)} size={24} color={getTypeColor(ex.type)} />
              </View>
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{ex.name}</Text>
                <Text style={styles.exerciseMeta}>{ex.type} - {ex.difficulty}</Text>
                <Text style={styles.exerciseDesc}>{ex.description}</Text>
              </View>
              <View style={styles.exerciseCal}>
                <Text style={styles.exerciseCalText}>{ex.calories_per_min}</Text>
                <Text style={styles.exerciseCalLabel}>kcal/dk</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tüm Egzersizler</Text>
          {allExercises.map((ex, i) => (
            <TouchableOpacity testID={`exercise-${i}`} key={i} style={styles.simpleExItem} onPress={() => openLog(ex)}>
              <View style={styles.simpleExInfo}>
                <Text style={styles.simpleExName}>{ex.name}</Text>
                <Text style={styles.simpleExType}>{ex.type} - {ex.difficulty}</Text>
              </View>
              <View style={styles.simpleExRight}>
                <Text style={styles.simpleExCal}>{ex.calories_per_min} kcal/dk</Text>
                <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal visible={showLogModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Egzersiz Kaydet</Text>
              <TouchableOpacity testID="close-exercise-modal" onPress={() => setShowLogModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            {selectedExercise && (
              <>
                <Text style={styles.selectedName}>{selectedExercise.name}</Text>
                <Text style={styles.selectedDesc}>{selectedExercise.description}</Text>
                <View style={styles.durationInput}>
                  <Text style={styles.inputLabel}>Süre (dakika)</Text>
                  <TextInput
                    testID="duration-input"
                    style={styles.input}
                    value={duration}
                    onChangeText={(v) => setDuration(v.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    placeholder="30"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={styles.burnEstimate}>
                  <Ionicons name="flame" size={20} color={COLORS.primary} />
                  <Text style={styles.burnText}>
                    Tahmini yakım: {(parseInt(duration) || 0) * (selectedExercise.calories_per_min || 5)} kcal
                  </Text>
                </View>
                <TouchableOpacity testID="log-exercise-btn" style={styles.logBtn} onPress={logExercise} disabled={logLoading}>
                  {logLoading ? <ActivityIndicator color={COLORS.white} /> : (
                    <Text style={styles.logBtnText}>Kaydet</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function getTypeIcon(type: string): any {
  const map: any = { Kardiyo: 'heart', Kuvvet: 'barbell', Esneklik: 'body', HIIT: 'flash' };
  return map[type] || 'fitness';
}

function getTypeColor(type: string): string {
  const map: any = { Kardiyo: '#E53935', Kuvvet: '#1E88E5', Esneklik: '#43A047', HIIT: '#FB8C00' };
  return map[type] || COLORS.primary;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: {
    fontSize: FONT_SIZE.xl, fontWeight: '300', color: COLORS.textPrimary,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm, letterSpacing: -0.5,
  },
  todayCard: {
    marginHorizontal: SPACING.lg, marginTop: SPACING.sm, padding: SPACING.lg,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border,
  },
  todayRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  todayStat: { alignItems: 'center', gap: 4 },
  todayValue: { fontSize: FONT_SIZE.xl, fontWeight: '600', color: COLORS.textPrimary },
  todayLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  todayDivider: { width: 1, height: 40, backgroundColor: COLORS.border },
  section: { marginTop: SPACING.lg, paddingHorizontal: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.md },
  exerciseCard: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.md,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  exerciseIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary },
  exerciseMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  exerciseDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  exerciseCal: { alignItems: 'center' },
  exerciseCalText: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.primary },
  exerciseCalLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  simpleExItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceAlt,
  },
  simpleExInfo: { flex: 1 },
  simpleExName: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary, fontWeight: '500' },
  simpleExType: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  simpleExRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  simpleExCal: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  logItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceAlt,
  },
  logInfo: { flex: 1 },
  logName: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary, fontWeight: '500' },
  logMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  logCal: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.primary },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.background, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.textPrimary },
  selectedName: { fontSize: FONT_SIZE.xl, fontWeight: '600', color: COLORS.textPrimary },
  selectedDesc: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4, marginBottom: SPACING.lg },
  durationInput: { marginBottom: SPACING.md },
  inputLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: COLORS.surfaceAlt, height: 52, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZE.lg, color: COLORS.textPrimary, textAlign: 'center',
  },
  burnEstimate: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.md, backgroundColor: COLORS.primary + '08', borderRadius: RADIUS.lg, marginBottom: SPACING.lg,
  },
  burnText: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary, fontWeight: '500' },
  logBtn: {
    backgroundColor: COLORS.primary, height: 56, borderRadius: RADIUS.xl,
    alignItems: 'center', justifyContent: 'center',
  },
  logBtnText: { color: COLORS.white, fontSize: FONT_SIZE.lg, fontWeight: '600' },
});
