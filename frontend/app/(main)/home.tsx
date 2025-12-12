import React, { useEffect, useState, useMemo, useRef } from 'react';
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
import { computeStreak, getStreakMessage, getStreakColor } from '../../utils/streakCalculator';

const { width } = Dimensions.get('window');

// Random tips pool
const QUICK_TIPS = [
  "Take photos in good lighting for better nutrition analysis.",
  "Add a protein source to every meal to stay full longer.",
  "Rotate your veggies for balanced micronutrients.",
  "Drink water 30 minutes before meals to aid digestion.",
  "Track your meals consistently to see better insights.",
];

// Nutrition facts pool
const NUTRITION_FACTS = [
  { emoji: "🍞🥘", text: "Roti + Dal is a complete protein combo" },
  { emoji: "🍌", text: "Bananas provide quick-release carbs — great pre-workout" },
  { emoji: "🌱", text: "Sprouts help boost daily protein intake naturally" },
  { emoji: "🥬", text: "Spinach is rich in iron and supports muscle recovery" },
  { emoji: "🥜", text: "Almonds contain healthy fats that support brain health" },
];

// Daily highlights
const DAILY_HIGHLIGHTS = [
  { icon: "trophy", color: Colors.warning, text: "You hit 80% of your protein goal yesterday — great job!" },
  { icon: "flame", color: Colors.error, text: "Your last 3 days have been consistently within calorie target." },
  { icon: "star", color: Colors.secondary, text: "You're building a healthy eating routine!" },
  { icon: "checkmark-circle", color: Colors.success, text: "Keep tracking — insights get better with more data!" },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const [summary, setSummary] = useState<any>(null);
  const [meals, setMeals] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Random selections (memoized to persist during session)
  const quickTip = useMemo(() => QUICK_TIPS[Math.floor(Math.random() * QUICK_TIPS.length)], []);
  const nutritionFact = useMemo(() => NUTRITION_FACTS[Math.floor(Math.random() * NUTRITION_FACTS.length)], []);
  const dailyHighlight = useMemo(() => DAILY_HIGHLIGHTS[Math.floor(Math.random() * DAILY_HIGHLIGHTS.length)], []);

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    loadSummary().catch((error) => {
      console.error('Failed to load summary on mount:', error);
    });
  }, []);

  const loadSummary = async () => {
    if (!token) return;
    
    try {
      const [summaryData, mealsData] = await Promise.all([
        api.getTodaySummary(token),
        api.getMeals(token, 30),
      ]);
      setSummary(summaryData);
      
      // Ensure mealsData is an array before setting
      const meals = Array.isArray(mealsData) ? mealsData : [];
      setMeals(meals);
      
      // Compute streak from meals
      const calculatedStreak = computeStreak(meals, user?.timezone || 'Asia/Kolkata');
      setStreak(calculatedStreak);
    } catch (error: any) {
      console.error('Failed to load summary:', error);
      // Set empty state on error
      setMeals([]);
      setStreak(0);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadSummary();
    setIsRefreshing(false);
  };

  const calorieProgress = summary?.total_calories || 0;
  const calorieTarget = summary?.calorie_target || user?.daily_calorie_target || 2000;
  const proteinProgress = summary?.total_protein || 0;
  const proteinTarget = summary?.protein_target || user?.daily_protein_target || 50;
  const mealCount = summary?.meal_count || 0;
  const caloriePercentage = ((calorieProgress / calorieTarget) * 100).toFixed(0);
  const proteinPercentage = ((proteinProgress / proteinTarget) * 100).toFixed(0);

  // Mini chart data (last 7 days)
  const miniChartData = [65, 72, 80, 75, 85, 78, Number(caloriePercentage)];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Subtle Background Gradient Overlay */}
        <View style={styles.backgroundAccent}>
          <View style={[styles.gradientCircle, { top: -50, right: -50 }]} />
          <View style={[styles.gradientCircle, { bottom: 100, left: -80 }]} />
        </View>

        {/* EXISTING: Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name}!</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </View>
        </Animated.View>

        {/* EXISTING: Calorie Card */}
        <Animated.View style={[styles.calorieCard, { opacity: fadeAnim }]}>
          <Text style={styles.calorieLabel}>Today's Calories</Text>
          <Text style={styles.calorieValue}>{calorieProgress.toFixed(0)}</Text>
          <Text style={styles.calorieTarget}>of {calorieTarget} kcal</Text>
          <View style={styles.progressBar}>
            <Animated.View 
              style={[
                styles.progressFill, 
                { width: `${Math.min(Number(caloriePercentage), 100)}%` }
              ]} 
            />
          </View>
        </Animated.View>

        {/* EXISTING: Stats Row */}
        <View style={styles.statsRow}>
          <Animated.View style={[styles.statCard, { opacity: fadeAnim }]}>
            <Ionicons name="nutrition" size={24} color={Colors.secondary} />
            <Text style={styles.statValue}>{proteinProgress.toFixed(0)}g</Text>
            <Text style={styles.statLabel}>Protein</Text>
          </Animated.View>
          <Animated.View style={[styles.statCard, { opacity: fadeAnim }]}>
            <Ionicons name="restaurant" size={24} color={Colors.primary} />
            <Text style={styles.statValue}>{mealCount}</Text>
            <Text style={styles.statLabel}>Meals</Text>
          </Animated.View>
        </View>

        {/* EXISTING: Scan Button */}
        <TouchableOpacity style={styles.scanButton} onPress={() => router.push('/(main)/camera-scan')}>
          <Ionicons name="scan" size={24} color={Colors.background} />
          <Text style={styles.scanButtonText}>Scan Meal</Text>
        </TouchableOpacity>

        {/* NEW 1: Daily Highlight Card */}
        <Animated.View style={[styles.highlightCard, { opacity: fadeAnim }]}>
          <View style={[styles.highlightIconContainer, { backgroundColor: dailyHighlight.color + '20' }]}>
            <Ionicons name={dailyHighlight.icon as any} size={28} color={dailyHighlight.color} />
          </View>
          <View style={styles.highlightContent}>
            <Text style={styles.highlightTitle}>Daily Highlight</Text>
            <Text style={styles.highlightText}>{dailyHighlight.text}</Text>
          </View>
        </Animated.View>

        {/* NEW 2: Mini Wellness Streak (Live Data) */}
        <View style={styles.streakCard}>
          <View style={styles.streakHeader}>
            <Ionicons name="flame" size={20} color={getStreakColor(streak)} />
            <Text style={styles.streakTitle}>{getStreakMessage(streak)}</Text>
          </View>
          {streak > 0 && (
            <>
              <Text style={styles.streakSubtext}>You've logged meals for {streak} consecutive day{streak > 1 ? 's' : ''}!</Text>
              <View style={styles.streakBarContainer}>
                {[...Array(7)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.streakBar,
                      i < streak ? { backgroundColor: getStreakColor(streak) } : styles.streakBarInactive,
                    ]}
                  />
                ))}
              </View>
            </>
          )}
        </View>

        {/* NEW 3: Micro Chart Preview */}
        <TouchableOpacity 
          style={styles.miniChartCard}
          onPress={() => router.push('/(main)/insights')}
          activeOpacity={0.7}
        >
          <View style={styles.miniChartHeader}>
            <Text style={styles.miniChartTitle}>Last 7 Days Progress</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </View>
          <View style={styles.miniChart}>
            {miniChartData.map((value, index) => (
              <View key={index} style={styles.miniChartBarContainer}>
                <View
                  style={[
                    styles.miniChartBar,
                    { height: `${Math.min(value, 100)}%`, backgroundColor: value >= 80 ? Colors.secondary : Colors.primary },
                  ]}
                />
              </View>
            ))}
          </View>
          <Text style={styles.miniChartLabel}>Tap to view detailed insights</Text>
        </TouchableOpacity>

        {/* NEW 4: Dynamic Nutrition Fact */}
        <View style={styles.factCard}>
          <Text style={styles.factEmoji}>{nutritionFact.emoji}</Text>
          <View style={styles.factContent}>
            <Text style={styles.factTitle}>Did you know?</Text>
            <Text style={styles.factText}>{nutritionFact.text}</Text>
          </View>
        </View>

        {/* NEW 6: Suggested Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.actionsTitle}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity 
              style={styles.actionChip}
              onPress={() => router.push('/(main)/insights')}
            >
              <Ionicons name="trending-up" size={16} color={Colors.primary} />
              <Text style={styles.actionChipText}>Weekly Trend</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionChip}
              onPress={() => router.push('/(main)/history')}
            >
              <Ionicons name="time" size={16} color={Colors.primary} />
              <Text style={styles.actionChipText}>View History</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* EXISTING: Quick Tip (Enhanced with randomization) */}
        <View style={styles.tipCard}>
          <Ionicons name="bulb" size={24} color={Colors.warning} />
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Quick Tip</Text>
            <Text style={styles.tipText}>{quickTip}</Text>
          </View>
        </View>

        {/* NEW 7: Food Avatar Decorations */}
        <View style={styles.foodAvatarsContainer}>
          {['🍎', '🥗', '🍗', '🥛', '🥕'].map((emoji, index) => (
            <View key={index} style={styles.foodAvatar}>
              <Text style={styles.foodAvatarEmoji}>{emoji}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 20, paddingBottom: 120 },
  backgroundAccent: { position: 'absolute', width: '100%', height: '100%', overflow: 'hidden' },
  gradientCircle: { 
    position: 'absolute', 
    width: 200, 
    height: 200, 
    borderRadius: 100, 
    backgroundColor: Colors.primary, 
    opacity: 0.03 
  },
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
  
  // NEW: Daily Highlight
  highlightCard: { flexDirection: 'row', backgroundColor: Colors.cardBackground, borderRadius: 16, padding: 20, marginBottom: 20, gap: 16 },
  highlightIconContainer: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  highlightContent: { flex: 1, justifyContent: 'center' },
  highlightTitle: { fontSize: 14, fontWeight: '600', color: Colors.primary, marginBottom: 4 },
  highlightText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  
  // NEW: Streak
  streakCard: { backgroundColor: Colors.cardBackground, borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: Colors.warning + '30' },
  streakHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  streakTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  streakSubtext: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12 },
  streakBarContainer: { flexDirection: 'row', gap: 6 },
  streakBar: { flex: 1, height: 6, borderRadius: 3 },
  streakBarActive: { backgroundColor: Colors.warning },
  streakBarInactive: { backgroundColor: Colors.surface },
  
  // NEW: Mini Chart
  miniChartCard: { backgroundColor: Colors.cardBackground, borderRadius: 16, padding: 20, marginBottom: 20 },
  miniChartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  miniChartTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  miniChart: { flexDirection: 'row', height: 60, gap: 4, marginBottom: 12, alignItems: 'flex-end' },
  miniChartBarContainer: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  miniChartBar: { width: '100%', borderRadius: 2 },
  miniChartLabel: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
  
  // NEW: Nutrition Fact
  factCard: { flexDirection: 'row', backgroundColor: Colors.cardBackground, borderRadius: 16, padding: 20, marginBottom: 20, gap: 16, borderWidth: 1, borderColor: Colors.secondary + '20' },
  factEmoji: { fontSize: 36 },
  factContent: { flex: 1, justifyContent: 'center' },
  factTitle: { fontSize: 14, fontWeight: '600', color: Colors.secondary, marginBottom: 4 },
  factText: { fontSize: 13, color: Colors.text, lineHeight: 19 },
  
  // NEW: Quick Actions
  actionsContainer: { marginBottom: 20 },
  actionsTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardBackground, borderRadius: 12, paddingVertical: 12, gap: 8, borderWidth: 1, borderColor: Colors.primary + '30' },
  actionChipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  
  // EXISTING: Tip Card
  tipCard: { flexDirection: 'row', backgroundColor: Colors.cardBackground, borderRadius: 16, padding: 20, gap: 16, borderWidth: 1, borderColor: Colors.warning + '30', marginBottom: 24 },
  tipContent: { flex: 1 },
  tipTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  tipText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  
  // NEW: Food Avatars
  foodAvatarsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 8 },
  foodAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  foodAvatarEmoji: { fontSize: 24 },
});
