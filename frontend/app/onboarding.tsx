import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import Colors from '../constants/Colors';

const GOALS = [
  { value: 'health', label: 'Maintain Health', icon: 'heart' },
  { value: 'fat_loss', label: 'Lose Weight', icon: 'trending-down' },
  { value: 'muscular', label: 'Build Muscle', icon: 'barbell' },
  { value: 'lean', label: 'Get Lean', icon: 'fitness' },
];

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light Activity' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Very Active' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, token, updateUser } = useAuthStore();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    gender: '',
    age: '',
    height_cm: '',
    weight_kg: '',
    goal: '',
    activity_level: '',
  });

  const handleNext = () => {
    if (step === 1) {
      if (!formData.gender || !formData.age) {
        Alert.alert('Required', 'Please fill in all fields');
        return;
      }
    } else if (step === 2) {
      if (!formData.height_cm || !formData.weight_kg) {
        Alert.alert('Required', 'Please fill in all fields');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleComplete = async () => {
    if (!formData.goal || !formData.activity_level) {
      Alert.alert('Required', 'Please select your goal and activity level');
      return;
    }

    setIsLoading(true);
    try {
      const updatedUser = await api.updateProfile(
        {
          ...formData,
          age: parseInt(formData.age),
          height_cm: parseFloat(formData.height_cm),
          weight_kg: parseFloat(formData.weight_kg),
          consent_given: true,
        },
        token!
      );
      updateUser(updatedUser);
      router.replace('/(main)/home');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Let's get to know you</Text>
      <Text style={styles.stepSubtitle}>Basic information to personalize your experience</Text>

      <Text style={styles.label}>Gender</Text>
      <View style={styles.optionRow}>
        <TouchableOpacity
          style={[
            styles.optionButton,
            formData.gender === 'male' && styles.optionButtonActive,
          ]}
          onPress={() => setFormData({ ...formData, gender: 'male' })}
        >
          <Ionicons
            name="male"
            size={24}
            color={formData.gender === 'male' ? Colors.background : Colors.text}
          />
          <Text
            style={[
              styles.optionText,
              formData.gender === 'male' && styles.optionTextActive,
            ]}
          >
            Male
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionButton,
            formData.gender === 'female' && styles.optionButtonActive,
          ]}
          onPress={() => setFormData({ ...formData, gender: 'female' })}
        >
          <Ionicons
            name="female"
            size={24}
            color={formData.gender === 'female' ? Colors.background : Colors.text}
          />
          <Text
            style={[
              styles.optionText,
              formData.gender === 'female' && styles.optionTextActive,
            ]}
          >
            Female
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Age</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter your age"
          placeholderTextColor={Colors.textSecondary}
          value={formData.age}
          onChangeText={(text) => setFormData({ ...formData, age: text })}
          keyboardType="number-pad"
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Your measurements</Text>
      <Text style={styles.stepSubtitle}>Help us calculate your nutrition needs</Text>

      <Text style={styles.label}>Height (cm)</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter height in cm"
          placeholderTextColor={Colors.textSecondary}
          value={formData.height_cm}
          onChangeText={(text) => setFormData({ ...formData, height_cm: text })}
          keyboardType="decimal-pad"
        />
      </View>

      <Text style={styles.label}>Weight (kg)</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter weight in kg"
          placeholderTextColor={Colors.textSecondary}
          value={formData.weight_kg}
          onChangeText={(text) => setFormData({ ...formData, weight_kg: text })}
          keyboardType="decimal-pad"
        />
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Your fitness goal</Text>
      <Text style={styles.stepSubtitle}>What would you like to achieve?</Text>

      <View style={styles.goalsGrid}>
        {GOALS.map((goal) => (
          <TouchableOpacity
            key={goal.value}
            style={[
              styles.goalCard,
              formData.goal === goal.value && styles.goalCardActive,
            ]}
            onPress={() => setFormData({ ...formData, goal: goal.value })}
          >
            <Ionicons
              name={goal.icon as any}
              size={32}
              color={formData.goal === goal.value ? Colors.background : Colors.primary}
            />
            <Text
              style={[
                styles.goalText,
                formData.goal === goal.value && styles.goalTextActive,
              ]}
            >
              {goal.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Activity Level</Text>
      {ACTIVITY_LEVELS.map((level) => (
        <TouchableOpacity
          key={level.value}
          style={[
            styles.activityButton,
            formData.activity_level === level.value && styles.activityButtonActive,
          ]}
          onPress={() => setFormData({ ...formData, activity_level: level.value })}
        >
          <Text
            style={[
              styles.activityText,
              formData.activity_level === level.value && styles.activityTextActive,
            ]}
          >
            {level.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.progress}>
          <View style={[styles.progressBar, { width: `${(step / 3) * 100}%` }]} />
        </View>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        <View style={styles.buttons}>
          {step > 1 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep(step - 1)}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, (step === 1 || isLoading) && styles.buttonFlex]}
            onPress={step === 3 ? handleComplete : handleNext}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.buttonText}>
                {step === 3 ? 'Complete' : 'Next'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  progress: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginBottom: 32,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  optionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  optionButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  optionTextActive: {
    color: Colors.background,
  },
  inputContainer: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  input: {
    height: 56,
    paddingHorizontal: 16,
    color: Colors.text,
    fontSize: 16,
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  goalCard: {
    width: '48%',
    aspectRatio: 1.2,
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  goalCardActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  goalText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  goalTextActive: {
    color: Colors.background,
  },
  activityButton: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  activityButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  activityText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  activityTextActive: {
    color: Colors.background,
  },
  buttons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 'auto',
    paddingTop: 24,
  },
  backButton: {
    flex: 1,
    height: 56,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  button: {
    flex: 1,
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFlex: {
    flex: 2,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.background,
  },
});