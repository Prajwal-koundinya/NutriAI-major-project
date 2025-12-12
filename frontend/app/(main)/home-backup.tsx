import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import Colors from '../../constants/Colors';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const [summary, setSummary] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadSummary = async () => {
    try {
      const data = await api.getTodaySummary(token!);
      setSummary(data);
    } catch (error: any) {
      console.error('Failed to load summary:', error);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadSummary();
    setIsRefreshing(false);
  };

  const calorieProgress = summary?.total_calories || 0;
  const calorieTarget = summary?.calorie_target || user?.daily_calorie_target || 2000;
  const proteinProgress = summary?.total_protein || 0;
  const mealCount = summary?.meal_count || 0;
  const caloriePercentage = ((calorieProgress / calorieTarget) * 100).toFixed(0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name}!</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </View>
        </View>

        <View style={styles.calorieCard}>
          <Text style={styles.calorieLabel}>Today's Calories</Text>
          <Text style={styles.calorieValue}>{calorieProgress.toFixed(0)}</Text>
          <Text style={styles.calorieTarget}>of {calorieTarget} kcal</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(Number(caloriePercentage), 100)}%` }]} />
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="nutrition" size={24} color={Colors.secondary} />
            <Text style={styles.statValue}>{proteinProgress.toFixed(0)}g</Text>
            <Text style={styles.statLabel}>Protein</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="restaurant" size={24} color={Colors.primary} />
            <Text style={styles.statValue}>{mealCount}</Text>
            <Text style={styles.statLabel}>Meals</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.scanButton} onPress={() => router.push('/(main)/scan')}>
          <Ionicons name="scan" size={24} color={Colors.background} />
          <Text style={styles.scanButtonText}>Scan Meal</Text>
        </TouchableOpacity>

        <View style={styles.tipCard}>
          <Ionicons name="bulb" size={24} color={Colors.warning} />
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Quick Tip</Text>
            <Text style={styles.tipText}>Track your meals consistently to see better insights!</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 24 },
  greeting: { fontSize: 28, fontWeight: 'bold', color: Colors.text },
  date: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  calorieCard: { backgroundColor: Colors.cardBackground, borderRadius: 20, padding: 32, alignItems: 'center', marginBottom: 20 },
  calorieLabel: { fontSize: 16, color: Colors.textSecondary, marginBottom: 8 },
  calorieValue: { fontSize: 48, fontWeight: 'bold', color: Colors.primary },
  calorieTarget: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  progressBar: { width: '100%', height: 8, backgroundColor: Colors.surface, borderRadius: 4, marginTop: 16, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: Colors.cardBackground, borderRadius: 16, padding: 20, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginTop: 8 },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  scanButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 18, marginBottom: 24, gap: 12 },
  scanButtonText: { fontSize: 18, fontWeight: '600', color: Colors.background },
  tipCard: { flexDirection: 'row', backgroundColor: Colors.cardBackground, borderRadius: 16, padding: 20, gap: 16, borderWidth: 1, borderColor: Colors.warning + '30' },
  tipContent: { flex: 1 },
  tipTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  tipText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
});
