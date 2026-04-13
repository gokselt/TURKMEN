import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../src/theme';
import { api } from '../../src/api';

export default function ProfileScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [motivation, setMotivation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [weightLoading, setWeightLoading] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const id = await AsyncStorage.getItem('user_id');
    setUserId(id);
    if (id) loadData(id);
  };

  const loadData = async (id: string) => {
    try {
      const [u, p, m] = await Promise.all([
        api.getUser(id),
        api.getProgress(id),
        api.getMotivation(id),
      ]);
      setUser(u);
      setProgress(p);
      setMotivation(m);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = useCallback(() => { if (userId) { setRefreshing(true); loadData(userId); } }, [userId]);

  const logWeight = async () => {
    if (!userId || !newWeight) return;
    setWeightLoading(true);
    try {
      await api.logWeight({ user_id: userId, weight: parseFloat(newWeight) });
      setShowWeightModal(false);
      setNewWeight('');
      loadData(userId);
    } catch (err) { console.error(err); }
    finally { setWeightLoading(false); }
  };

  const handleLogout = async () => {
    Alert.alert('Çıkış', 'Profil verileriniz korunacak. Çıkmak istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap', style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem('user_id');
          await AsyncStorage.removeItem('user_name');
          router.replace('/');
        }
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  const goalText = user?.goal === 'kilo_ver' ? 'Kilo Vermek' : user?.goal === 'kilo_al' ? 'Kilo Almak' : 'Kilo Korumak';
  const activityText: Record<string, string> = {
    sedanter: 'Sedanter', hafif_aktif: 'Hafif Aktif', orta_aktif: 'Orta Aktif',
    aktif: 'Aktif', cok_aktif: 'Çok Aktif',
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userGoal}>{goalText} - {activityText[user?.activity_level] || ''}</Text>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Kilo" value={`${user?.weight || 0}`} unit="kg" icon="scale-outline" />
          <StatCard label="Hedef" value={`${user?.target_weight || 0}`} unit="kg" icon="flag-outline" />
          <StatCard label="Boy" value={`${user?.height || 0}`} unit="cm" icon="resize-outline" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Günlük Hedefler</Text>
          <View style={styles.targetCard}>
            <TargetRow icon="flame-outline" label="Kalori" value={`${user?.daily_calorie_target || 0} kcal`} color={COLORS.primary} />
            <TargetRow icon="egg-outline" label="Protein" value={`${user?.daily_protein || 0}g`} color="#E53935" />
            <TargetRow icon="nutrition-outline" label="Karbonhidrat" value={`${user?.daily_carbs || 0}g`} color="#43A047" />
            <TargetRow icon="water-outline" label="Yağ" value={`${user?.daily_fat || 0}g`} color="#FFA726" />
          </View>
        </View>

        <TouchableOpacity testID="log-weight-btn" style={styles.weightBtn} onPress={() => setShowWeightModal(true)}>
          <Ionicons name="scale-outline" size={20} color={COLORS.primary} />
          <Text style={styles.weightBtnText}>Kilo Kaydet</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {progress?.weight_history?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kilo Geçmişi</Text>
            {progress.weight_history.slice(0, 10).map((w: any, i: number) => (
              <View key={i} style={styles.weightItem}>
                <Text style={styles.weightDate}>{w.date}</Text>
                <Text style={styles.weightValue}>{w.weight} kg</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Başarılar</Text>
          <View style={styles.achievementGrid}>
            {motivation?.achievements?.map((a: any, i: number) => (
              <View key={i} style={[styles.achievementItem, !a.unlocked && styles.achievementLocked]}>
                <Text style={styles.achievementIcon}>{a.icon}</Text>
                <Text style={styles.achievementTitle}>{a.title}</Text>
                <Text style={styles.achievementDesc}>{a.description}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İstatistikler</Text>
          <View style={styles.statsList}>
            <StatRow label="Toplam Öğün" value={`${progress?.total_meals_logged || 0}`} icon="restaurant" />
            <StatRow label="Toplam Egzersiz" value={`${progress?.total_exercises_done || 0}`} icon="fitness" />
            <StatRow label="Bugün Alınan" value={`${progress?.today_calories_consumed || 0} kcal`} icon="flame" />
            <StatRow label="Bugün Yakılan" value={`${progress?.today_calories_burned || 0} kcal`} icon="flash" />
          </View>
        </View>

        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showWeightModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kilo Kaydet</Text>
              <TouchableOpacity testID="close-weight-modal" onPress={() => setShowWeightModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.currentWeight}>Mevcut: {user?.weight} kg</Text>
            <TextInput
              testID="weight-input"
              style={styles.weightInput}
              value={newWeight}
              onChangeText={(v) => setNewWeight(v.replace(/[^0-9.]/g, ''))}
              placeholder="Yeni kilonuz"
              keyboardType="numeric"
              placeholderTextColor={COLORS.textSecondary}
            />
            <TouchableOpacity testID="save-weight-btn" style={styles.saveBtn} onPress={logWeight} disabled={weightLoading || !newWeight}>
              {weightLoading ? <ActivityIndicator color={COLORS.white} /> : (
                <Text style={styles.saveBtnText}>Kaydet</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({ label, value, unit, icon }: { label: string; value: string; unit: string; icon: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as any} size={20} color={COLORS.primary} />
      <Text style={styles.statCardValue}>{value}</Text>
      <Text style={styles.statCardUnit}>{unit}</Text>
      <Text style={styles.statCardLabel}>{label}</Text>
    </View>
  );
}

function TargetRow({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={styles.targetRow}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={styles.targetLabel}>{label}</Text>
      <Text style={[styles.targetValue, { color }]}>{value}</Text>
    </View>
  );
}

function StatRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.statRow}>
      <Ionicons name={icon as any} size={18} color={COLORS.textSecondary} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', paddingTop: SPACING.lg, paddingBottom: SPACING.md },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md,
  },
  avatarText: { fontSize: 32, fontWeight: '300', color: COLORS.white },
  userName: { fontSize: FONT_SIZE.xl, fontWeight: '300', color: COLORS.textPrimary },
  userGoal: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4 },
  statsRow: { flexDirection: 'row', paddingHorizontal: SPACING.lg, gap: SPACING.sm, marginTop: SPACING.md },
  statCard: {
    flex: 1, alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, gap: 2,
  },
  statCardValue: { fontSize: FONT_SIZE.xl, fontWeight: '600', color: COLORS.textPrimary },
  statCardUnit: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  statCardLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  section: { marginTop: SPACING.lg, paddingHorizontal: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.md },
  targetCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
  },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  targetLabel: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.textPrimary },
  targetValue: { fontSize: FONT_SIZE.md, fontWeight: '600' },
  weightBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.lg, marginTop: SPACING.lg, padding: SPACING.md,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
  },
  weightBtnText: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.textPrimary, fontWeight: '500' },
  weightItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceAlt,
  },
  weightDate: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  weightValue: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary },
  achievementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  achievementItem: {
    width: '47%', padding: SPACING.md, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  achievementLocked: { opacity: 0.4 },
  achievementIcon: { fontSize: 28 },
  achievementTitle: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textPrimary, marginTop: 4, textAlign: 'center' },
  achievementDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },
  statsList: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
  },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  statLabel: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.textPrimary },
  statValue: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.primary },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.lg, marginTop: SPACING.xl, padding: SPACING.md,
    borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.error + '40',
  },
  logoutText: { fontSize: FONT_SIZE.md, color: COLORS.error, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.background, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.textPrimary },
  currentWeight: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING.md },
  weightInput: {
    backgroundColor: COLORS.surfaceAlt, height: 56, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary, textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  saveBtn: {
    backgroundColor: COLORS.primary, height: 56, borderRadius: RADIUS.xl,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: COLORS.white, fontSize: FONT_SIZE.lg, fontWeight: '600' },
});
