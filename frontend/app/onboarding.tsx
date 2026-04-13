import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../src/theme';
import { api } from '../src/api';

const STEPS = ['Kişisel', 'Ölçüler', 'Aktivite', 'Hedef'];

const GENDERS = [
  { key: 'erkek', label: 'Erkek', icon: 'male' },
  { key: 'kadin', label: 'Kadın', icon: 'female' },
];

const ACTIVITIES = [
  { key: 'sedanter', label: 'Sedanter', desc: 'Masa başı iş, az hareket' },
  { key: 'hafif_aktif', label: 'Hafif Aktif', desc: 'Haftada 1-3 gün egzersiz' },
  { key: 'orta_aktif', label: 'Orta Aktif', desc: 'Haftada 3-5 gün egzersiz' },
  { key: 'aktif', label: 'Aktif', desc: 'Haftada 6-7 gün egzersiz' },
  { key: 'cok_aktif', label: 'Çok Aktif', desc: 'Ağır fiziksel iş/spor' },
];

const GOALS = [
  { key: 'kilo_ver', label: 'Kilo Vermek', icon: 'trending-down', color: '#4CAF50' },
  { key: 'kilo_koru', label: 'Kilo Korumak', icon: 'swap-horizontal', color: '#2196F3' },
  { key: 'kilo_al', label: 'Kilo Almak', icon: 'trending-up', color: '#FF9800' },
];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', age: '', gender: '', height: '', weight: '',
    target_weight: '', activity_level: '', goal: '',
  });

  const canNext = () => {
    if (step === 0) return form.name.length > 0 && form.age.length > 0 && form.gender.length > 0;
    if (step === 1) return form.height.length > 0 && form.weight.length > 0 && form.target_weight.length > 0;
    if (step === 2) return form.activity_level.length > 0;
    if (step === 3) return form.goal.length > 0;
    return false;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const userData = {
        name: form.name,
        age: parseInt(form.age),
        gender: form.gender,
        height: parseFloat(form.height),
        weight: parseFloat(form.weight),
        target_weight: parseFloat(form.target_weight),
        activity_level: form.activity_level,
        goal: form.goal,
      };
      const user = await api.createUser(userData);
      await AsyncStorage.setItem('user_id', user.id);
      await AsyncStorage.setItem('user_name', user.name);
      router.replace('/(tabs)');
    } catch (e: any) {
      console.error('Create user error:', e);
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else handleSubmit();
  };

  const renderStep0 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Seni Tanıyalım</Text>
      <Text style={styles.stepDesc}>Kişisel bilgilerini girelim</Text>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Adın</Text>
        <TextInput
          testID="input-name"
          style={styles.input}
          value={form.name}
          onChangeText={(v) => setForm({ ...form, name: v })}
          placeholder="Adınızı girin"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Yaşın</Text>
        <TextInput
          testID="input-age"
          style={styles.input}
          value={form.age}
          onChangeText={(v) => setForm({ ...form, age: v.replace(/[^0-9]/g, '') })}
          placeholder="25"
          keyboardType="numeric"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>
      <Text style={styles.inputLabel}>Cinsiyet</Text>
      <View style={styles.genderRow}>
        {GENDERS.map((g) => (
          <TouchableOpacity
            testID={`gender-${g.key}`}
            key={g.key}
            style={[styles.genderBtn, form.gender === g.key && styles.genderBtnActive]}
            onPress={() => setForm({ ...form, gender: g.key })}
          >
            <Ionicons name={g.icon as any} size={28} color={form.gender === g.key ? COLORS.white : COLORS.textPrimary} />
            <Text style={[styles.genderText, form.gender === g.key && styles.genderTextActive]}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Vücut Ölçülerin</Text>
      <Text style={styles.stepDesc}>Doğru hedefler belirlemek için gerekli</Text>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Boy (cm)</Text>
        <TextInput
          testID="input-height"
          style={styles.input}
          value={form.height}
          onChangeText={(v) => setForm({ ...form, height: v.replace(/[^0-9.]/g, '') })}
          placeholder="170"
          keyboardType="numeric"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Mevcut Kilo (kg)</Text>
        <TextInput
          testID="input-weight"
          style={styles.input}
          value={form.weight}
          onChangeText={(v) => setForm({ ...form, weight: v.replace(/[^0-9.]/g, '') })}
          placeholder="75"
          keyboardType="numeric"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Hedef Kilo (kg)</Text>
        <TextInput
          testID="input-target-weight"
          style={styles.input}
          value={form.target_weight}
          onChangeText={(v) => setForm({ ...form, target_weight: v.replace(/[^0-9.]/g, '') })}
          placeholder="68"
          keyboardType="numeric"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Aktivite Seviyesi</Text>
      <Text style={styles.stepDesc}>Günlük aktivite düzeyini seç</Text>
      {ACTIVITIES.map((a) => (
        <TouchableOpacity
          testID={`activity-${a.key}`}
          key={a.key}
          style={[styles.activityBtn, form.activity_level === a.key && styles.activityBtnActive]}
          onPress={() => setForm({ ...form, activity_level: a.key })}
        >
          <View style={styles.activityInfo}>
            <Text style={[styles.activityLabel, form.activity_level === a.key && styles.activityLabelActive]}>
              {a.label}
            </Text>
            <Text style={styles.activityDesc}>{a.desc}</Text>
          </View>
          {form.activity_level === a.key && (
            <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Hedefin Ne?</Text>
      <Text style={styles.stepDesc}>Sana uygun planı oluşturalım</Text>
      {GOALS.map((g) => (
        <TouchableOpacity
          testID={`goal-${g.key}`}
          key={g.key}
          style={[styles.goalBtn, form.goal === g.key && { ...styles.goalBtnActive, borderColor: g.color }]}
          onPress={() => setForm({ ...form, goal: g.key })}
        >
          <View style={[styles.goalIcon, { backgroundColor: g.color + '15' }]}>
            <Ionicons name={g.icon as any} size={28} color={g.color} />
          </View>
          <Text style={[styles.goalLabel, form.goal === g.key && { color: g.color }]}>{g.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        {step > 0 ? (
          <TouchableOpacity testID="back-btn" onPress={() => setStep(step - 1)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        ) : <View style={{ width: 44 }} />}
        <View style={styles.progress}>
          {STEPS.map((s, i) => (
            <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
          ))}
        </View>
        <Text style={styles.stepIndicator}>{step + 1}/{STEPS.length}</Text>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          testID="next-btn"
          style={[styles.nextBtn, !canNext() && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!canNext() || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Text style={styles.nextBtnText}>{step === 3 ? 'Tamamla' : 'Devam Et'}</Text>
              <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingTop: 60, paddingBottom: SPACING.md,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  progress: { flexDirection: 'row', gap: 6 },
  progressDot: { width: 32, height: 4, borderRadius: 2, backgroundColor: COLORS.border },
  progressDotActive: { backgroundColor: COLORS.primary },
  stepIndicator: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, width: 44, textAlign: 'right' },
  body: { flex: 1, paddingHorizontal: SPACING.lg },
  stepContent: { paddingTop: SPACING.lg },
  stepTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '300', color: COLORS.textPrimary, letterSpacing: -0.5 },
  stepDesc: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: SPACING.xs, marginBottom: SPACING.lg },
  inputGroup: { marginBottom: SPACING.md },
  inputLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: COLORS.surfaceAlt, height: 52, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.textPrimary, borderWidth: 1, borderColor: 'transparent',
  },
  genderRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
  genderBtn: {
    flex: 1, height: 80, borderRadius: RADIUS.lg, backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent',
  },
  genderBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  genderText: { fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, marginTop: 4, fontWeight: '500' },
  genderTextActive: { color: COLORS.white },
  activityBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.border,
  },
  activityBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  activityInfo: { flex: 1 },
  activityLabel: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary },
  activityLabelActive: { color: COLORS.primary },
  activityDesc: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  goalBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    padding: SPACING.lg, borderRadius: RADIUS.xl, marginBottom: SPACING.md,
    borderWidth: 2, borderColor: COLORS.border,
  },
  goalBtnActive: { borderWidth: 2 },
  goalIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  goalLabel: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.textPrimary },
  footer: { paddingHorizontal: SPACING.lg, paddingBottom: 40, paddingTop: SPACING.md },
  nextBtn: {
    backgroundColor: COLORS.primary, height: 56, borderRadius: RADIUS.xl,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: COLORS.white, fontSize: FONT_SIZE.lg, fontWeight: '600' },
});
