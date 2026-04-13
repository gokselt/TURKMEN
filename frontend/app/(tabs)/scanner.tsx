import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../../src/theme';
import { api } from '../../src/api';

export default function ScannerScreen() {
  const [mode, setMode] = useState<'plate' | 'menu'>('plate');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const pickImage = async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('İzin Gerekli', 'Fotoğraf erişimi için izin vermeniz gerekiyor.');
      return;
    }

    const pickerFn = useCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await pickerFn({
      base64: true,
      quality: 0.7,
      mediaTypes: ['images'],
    });

    if (!result.canceled && result.assets[0].base64) {
      scanImage(result.assets[0].base64);
    }
  };

  const scanImage = async (base64: string) => {
    setScanning(true);
    setResult(null);
    try {
      const res = mode === 'plate'
        ? await api.scanPlate(base64)
        : await api.scanMenu(base64);
      setResult(res);
    } catch (err) {
      console.error('Scan error:', err);
      Alert.alert('Hata', 'Tarama sırasında bir hata oluştu.');
    } finally {
      setScanning(false);
    }
  };

  const savePlateToMeals = async () => {
    if (!result?.foods) return;
    setSaving(true);
    try {
      const userId = await AsyncStorage.getItem('user_id');
      if (!userId) return;
      for (const food of result.foods) {
        await api.logMeal({
          user_id: userId,
          food_name: food.name,
          calories: food.calories || 0,
          protein: food.protein || 0,
          carbs: food.carbs || 0,
          fat: food.fat || 0,
          serving_size: food.estimated_portion || '1 porsiyon',
          meal_type: 'Tarama',
        });
      }
      Alert.alert('Kaydedildi', 'Yemekler öğün kaydınıza eklendi!');
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Yemek Tarayıcı</Text>

      <View style={styles.modeTabs}>
        <TouchableOpacity
          testID="mode-plate"
          style={[styles.modeTab, mode === 'plate' && styles.modeTabActive]}
          onPress={() => { setMode('plate'); setResult(null); }}
        >
          <Ionicons name="restaurant-outline" size={20} color={mode === 'plate' ? COLORS.white : COLORS.textPrimary} />
          <Text style={[styles.modeTabText, mode === 'plate' && styles.modeTabTextActive]}>Tabak Tara</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="mode-menu"
          style={[styles.modeTab, mode === 'menu' && styles.modeTabActive]}
          onPress={() => { setMode('menu'); setResult(null); }}
        >
          <Ionicons name="document-text-outline" size={20} color={mode === 'menu' ? COLORS.white : COLORS.textPrimary} />
          <Text style={[styles.modeTabText, mode === 'menu' && styles.modeTabTextActive]}>Menü Tara</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {!scanning && !result && (
          <View style={styles.scanArea}>
            <View style={styles.scanFrame}>
              <View style={styles.cornerTL} /><View style={styles.cornerTR} />
              <View style={styles.cornerBL} /><View style={styles.cornerBR} />
              <Ionicons name={mode === 'plate' ? 'restaurant' : 'document-text'} size={64} color={COLORS.border} />
              <Text style={styles.scanHint}>
                {mode === 'plate' ? 'Tabağınızın fotoğrafını çekin' : 'Kurum menüsünün fotoğrafını çekin'}
              </Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity testID="btn-camera" style={styles.actionBtn} onPress={() => pickImage(true)}>
                <View style={[styles.actionIcon, { backgroundColor: COLORS.primary }]}>
                  <Ionicons name="camera" size={28} color={COLORS.white} />
                </View>
                <Text style={styles.actionLabel}>Kamera</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="btn-gallery" style={styles.actionBtn} onPress={() => pickImage(false)}>
                <View style={[styles.actionIcon, { backgroundColor: COLORS.secondary }]}>
                  <Ionicons name="images" size={28} color={COLORS.white} />
                </View>
                <Text style={styles.actionLabel}>Galeri</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {scanning && (
          <View style={styles.scanningState}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.scanningText}>AI yemekleri analiz ediyor...</Text>
            <Text style={styles.scanningSubtext}>Bu birkaç saniye sürebilir</Text>
          </View>
        )}

        {result && mode === 'plate' && !result.error && (
          <View style={styles.resultSection}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Analiz Sonucu</Text>
              <View style={styles.totalBadge}>
                <Text style={styles.totalText}>{result.total_calories || 0} kcal</Text>
              </View>
            </View>

            {result.foods?.map((food: any, i: number) => (
              <View key={i} style={styles.resultItem}>
                <View style={styles.resultItemInfo}>
                  <Text style={styles.resultItemName}>{food.name}</Text>
                  <Text style={styles.resultItemPortion}>{food.estimated_portion}</Text>
                </View>
                <View style={styles.resultItemNutrition}>
                  <Text style={styles.resultItemCal}>{food.calories} kcal</Text>
                  <Text style={styles.resultItemMacro}>P:{food.protein}g K:{food.carbs}g Y:{food.fat}g</Text>
                </View>
              </View>
            ))}

            {result.diet_suitability && (
              <View style={styles.suitabilityCard}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.secondary} />
                <Text style={styles.suitabilityText}>{result.diet_suitability}</Text>
              </View>
            )}

            <View style={styles.resultActions}>
              <TouchableOpacity testID="save-plate-btn" style={styles.saveBtn} onPress={savePlateToMeals} disabled={saving}>
                {saving ? <ActivityIndicator color={COLORS.white} /> : (
                  <><Ionicons name="add-circle" size={20} color={COLORS.white} /><Text style={styles.saveBtnText}> Öğüne Ekle</Text></>
                )}
              </TouchableOpacity>
              <TouchableOpacity testID="rescan-btn" style={styles.rescanBtn} onPress={() => setResult(null)}>
                <Text style={styles.rescanText}>Tekrar Tara</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {result && mode === 'menu' && !result.error && (
          <View style={styles.resultSection}>
            <Text style={styles.resultTitle}>Menü Sonuçları</Text>
            {result.menu_source && <Text style={styles.menuSource}>{result.menu_source}</Text>}
            {result.menu_items?.map((item: any, i: number) => (
              <View key={i} style={styles.menuItem}>
                <View style={styles.menuItemInfo}>
                  <Text style={styles.menuItemName}>{item.name}</Text>
                  <Text style={styles.menuItemCategory}>{item.category} - {item.serving_size}</Text>
                </View>
                <Text style={styles.menuItemCal}>{item.calories} kcal</Text>
              </View>
            ))}
            <Text style={styles.menuSaved}>Yemekler veritabanına otomatik eklendi</Text>
            <TouchableOpacity testID="rescan-menu-btn" style={styles.rescanBtn} onPress={() => setResult(null)}>
              <Text style={styles.rescanText}>Başka Menü Tara</Text>
            </TouchableOpacity>
          </View>
        )}

        {result?.error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={24} color={COLORS.error} />
            <Text style={styles.errorText}>{result.error}</Text>
            <TouchableOpacity style={styles.rescanBtn} onPress={() => setResult(null)}>
              <Text style={styles.rescanText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const cornerBase = {
  position: 'absolute' as const, width: 24, height: 24,
  borderColor: COLORS.primary, borderWidth: 3,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  title: {
    fontSize: FONT_SIZE.xl, fontWeight: '300', color: COLORS.textPrimary,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, letterSpacing: -0.5,
  },
  modeTabs: {
    flexDirection: 'row', marginHorizontal: SPACING.lg, marginTop: SPACING.md,
    backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.lg, padding: 4,
  },
  modeTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: RADIUS.md,
  },
  modeTabActive: { backgroundColor: COLORS.primary },
  modeTabText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textPrimary },
  modeTabTextActive: { color: COLORS.white },
  scrollContent: { padding: SPACING.lg },
  scanArea: { alignItems: 'center', paddingTop: SPACING.xl },
  scanFrame: {
    width: 260, height: 260, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.xl, gap: SPACING.md,
  },
  cornerTL: { ...cornerBase, top: -2, left: -2, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: RADIUS.xl },
  cornerTR: { ...cornerBase, top: -2, right: -2, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: RADIUS.xl },
  cornerBL: { ...cornerBase, bottom: -2, left: -2, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: RADIUS.xl },
  cornerBR: { ...cornerBase, bottom: -2, right: -2, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: RADIUS.xl },
  scanHint: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: SPACING.lg },
  actionRow: { flexDirection: 'row', gap: SPACING.xl, marginTop: SPACING.xl },
  actionBtn: { alignItems: 'center', gap: SPACING.sm },
  actionIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, fontWeight: '500' },
  scanningState: { alignItems: 'center', paddingTop: 80, gap: SPACING.md },
  scanningText: { fontSize: FONT_SIZE.lg, color: COLORS.textPrimary, fontWeight: '500' },
  scanningSubtext: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  resultSection: { marginTop: SPACING.md },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  resultTitle: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.textPrimary },
  totalBadge: {
    backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full,
  },
  totalText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.sm },
  resultItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  resultItemInfo: { flex: 1 },
  resultItemName: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.textPrimary },
  resultItemPortion: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  resultItemNutrition: { alignItems: 'flex-end' },
  resultItemCal: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.primary },
  resultItemMacro: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  suitabilityCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, padding: SPACING.md,
    backgroundColor: COLORS.secondary + '12', borderRadius: RADIUS.lg, marginVertical: SPACING.md,
    borderWidth: 1, borderColor: COLORS.secondary + '30',
  },
  suitabilityText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, lineHeight: 20 },
  resultActions: { gap: SPACING.sm, marginTop: SPACING.md },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary, height: 52, borderRadius: RADIUS.xl,
  },
  saveBtnText: { color: COLORS.white, fontSize: FONT_SIZE.md, fontWeight: '600' },
  rescanBtn: {
    alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: RADIUS.xl,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  rescanText: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary, fontWeight: '500' },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceAlt,
  },
  menuItemInfo: { flex: 1 },
  menuItemName: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.textPrimary },
  menuItemCategory: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  menuItemCal: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.primary },
  menuSource: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING.md },
  menuSaved: {
    fontSize: FONT_SIZE.sm, color: COLORS.secondary, textAlign: 'center',
    marginVertical: SPACING.md, fontWeight: '500',
  },
  errorCard: {
    alignItems: 'center', padding: SPACING.xl, gap: SPACING.md,
    backgroundColor: COLORS.error + '08', borderRadius: RADIUS.lg,
  },
  errorText: { fontSize: FONT_SIZE.md, color: COLORS.error, textAlign: 'center' },
});
