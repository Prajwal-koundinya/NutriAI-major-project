import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import Colors from '../../constants/Colors';

const MEAL_TAGS = [
  { value: 'breakfast', label: 'Breakfast', icon: 'sunny' },
  { value: 'lunch', label: 'Lunch', icon: 'restaurant' },
  { value: 'dinner', label: 'Dinner', icon: 'moon' },
  { value: 'snack', label: 'Snack', icon: 'fast-food' },
];

export default function CameraScanScreen() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [selectedTag, setSelectedTag] = useState('snack');
  const [isSaving, setIsSaving] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // Optional portion override (grams or other units)
  const [showPortionInput, setShowPortionInput] = useState(false);
  const [portionAmount, setPortionAmount] = useState<string>('');
  const [portionUnit, setPortionUnit] = useState<string>('g');

  // Dev QA toggle (hidden)
  const [forcedConfidence, setForcedConfidence] = useState<number | null>(null);

  const handleRequestPermission = async () => {
    const { status } = await requestPermission();
    if (status === 'granted') {
      setShowCamera(true);
    } else {
      Alert.alert(
        'Camera Access Required',
        'Allow camera so you can scan meals and get instant nutrition analysis.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Allow Camera', onPress: requestPermission },
        ]
      );
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to select images.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets[0].base64) {
        setCapturedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
        setShowCamera(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image from gallery.');
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });
      setCapturedImage(`data:image/jpeg;base64,${photo.base64}`);
      setShowCamera(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const analyzeMeal = async () => {
    if (!capturedImage) return;

    setIsAnalyzing(true);
    try {
      console.log('Starting meal analysis...');
      const result = await api.analyzeMeal(capturedImage, selectedTag, token!);
      
      console.log('Analysis result received:', JSON.stringify(result).substring(0, 200));
      
      // Validate result has required fields
      if (!result || typeof result !== 'object') {
        console.error('Invalid result type:', result);
        throw new Error('Invalid response format — try again.');
      }
      
      if (!result.calories_kcal && result.calories_kcal !== 0) {
        console.error('Missing calories:', result);
        throw new Error('Nutrition data incomplete — try retaking the photo.');
      }
      
      if (!result.items || !Array.isArray(result.items) || result.items.length === 0) {
        console.error('Missing or empty items:', result.items);
        throw new Error('No food detected — try better lighting and ensure food is visible.');
      }
      
      // Apply forced confidence for QA testing
      if (forcedConfidence !== null) {
        result.confidence_score = forcedConfidence;
        result.needs_confirmation = forcedConfidence < 0.80;
        result.needs_portion_confirmation = forcedConfidence >= 0.50 && forcedConfidence < 0.80;
        result.very_low_confidence = forcedConfidence < 0.50;
      }
      
      console.log('Analysis successful, setting result');
      setAnalysisResult(result);
    } catch (error: any) {
      console.error('Analysis error:', error);
      const code = error?.code as string | undefined;
      const errorMessage = error?.message || 'Unable to analyze — try again.';
      let friendlyMessage = errorMessage;
      
      // Prefer backend error codes when available
      if (code === 'NETWORK') {
        friendlyMessage = 'Network issue — please retry.';
      } else if (code === 'TIMEOUT') {
        friendlyMessage = 'Analysis took too long — try again.';
      } else if (code === 'RATE_LIMIT') {
        friendlyMessage = 'Service temporarily busy — please try again in a minute.';
      } else if (code === 'SCHEMA_VALIDATION_ERROR') {
        friendlyMessage = 'Unexpected response — try retaking the photo.';
      } else {
        // Fallback: map error messages to friendly versions
        if (errorMessage.includes('Network') || errorMessage.includes('network')) {
          friendlyMessage = 'Network issue — please retry.';
        } else if (errorMessage.includes('timeout') || errorMessage.includes('took too long')) {
          friendlyMessage = 'Analysis took too long — try again.';
        } else if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
          friendlyMessage = 'Service temporarily busy — please try again in a minute.';
        } else if (errorMessage.includes('Unexpected response') || errorMessage.includes('validation')) {
          friendlyMessage = 'Unexpected response — try retaking the photo.';
        } else if (errorMessage.includes('incomplete') || errorMessage.includes('No food detected')) {
          friendlyMessage = errorMessage; // Use the specific message
        }
      }
      
      Alert.alert(
        'Analysis Issue',
        friendlyMessage,
        [
          { text: 'Retake Photo', onPress: () => { setCapturedImage(null); setShowCamera(true); } },
          { text: 'Pick from Gallery', onPress: pickImageFromGallery },
          { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
        ]
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveMeal = async () => {
    if (!analysisResult || !capturedImage) return;

    setIsSaving(true);
    try {
      await api.saveMeal(
        {
          image_base64: capturedImage,
          calories_kcal: analysisResult.calories_kcal,
          protein_g: analysisResult.protein_g,
          carbs_g: analysisResult.carbs_g,
          fat_g: analysisResult.fat_g,
          fiber_g: analysisResult.fiber_g || 0,
          sugar_g: analysisResult.sugar_g || 0,
          sodium_mg: analysisResult.sodium_mg || 0,
          confidence_score: analysisResult.confidence_score,
          items: analysisResult.items,
          recommendations: analysisResult.recommendations || [],
          explanation: analysisResult.explanation || [],
          user_confirmed: true,
          tag: selectedTag,
        },
        token!
      );
      
      // Navigate to home - it will automatically recalculate streak on mount
      Alert.alert(
        'Success!',
        'Meal saved — nice job logging that!',
        [{ 
          text: 'OK', 
          onPress: () => {
            // Reset state
            setCapturedImage(null);
            setAnalysisResult(null);
            setShowCamera(false);
            // Navigate to home (will trigger streak recalculation)
            router.replace('/(main)/home');
          }
        }]
      );
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to save meal';
      Alert.alert('Save Failed', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const retake = () => {
    setCapturedImage(null);
    setAnalysisResult(null);
    setShowCamera(true);
  };

  // Permission not determined
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Permission denied
  if (!permission.granted && !showCamera) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={80} color={Colors.textSecondary} />
          <Text style={styles.permissionTitle}>Enable Camera Access</Text>
          <Text style={styles.permissionText}>
            Allow camera so you can scan meals and get instant nutrition analysis.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleRequestPermission}>
            <Text style={styles.buttonText}>Allow Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancelText}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Analyzing state
  if (capturedImage && isAnalyzing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.analyzingContainer}>
          <Image source={{ uri: capturedImage }} style={styles.analyzingImage} />
          <View style={styles.analyzingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.analyzingText}>Analyzing your meal — almost done…</Text>
            <Text style={styles.analyzingSubtext}>This may take a few seconds</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Results screen
  if (capturedImage && analysisResult) {
    const needsConfirmation = analysisResult.needs_confirmation || analysisResult.very_low_confidence;
    
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Meal Analysis</Text>
            <View style={{ width: 24 }} />
          </View>

          <Image source={{ uri: capturedImage }} style={styles.previewImage} />

          {analysisResult.very_low_confidence && (
            <View style={[styles.warningBanner, { backgroundColor: Colors.error + '20' }]}>
              <Ionicons name="warning" size={20} color={Colors.error} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.warningText, { color: Colors.error }]}>
                  Hmm, I'm not confident about this item. Want to correct it or retry?
                </Text>
              </View>
            </View>
          )}

          {analysisResult.needs_portion_confirmation && !analysisResult.very_low_confidence && (
            <View style={styles.warningBanner}>
              <Ionicons name="information-circle" size={20} color={Colors.warning} />
              <Text style={styles.warningText}>
                Please confirm portion sizes are accurate before saving.
              </Text>
            </View>
          )}

          <View style={styles.nutritionCard}>
            <Text style={styles.cardTitle}>Nutrition Facts</Text>
            <View style={styles.nutritionGrid}>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{analysisResult.calories_kcal.toFixed(0)}</Text>
                <Text style={styles.nutritionLabel}>Calories</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{analysisResult.protein_g.toFixed(1)}g</Text>
                <Text style={styles.nutritionLabel}>Protein</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{analysisResult.carbs_g.toFixed(1)}g</Text>
                <Text style={styles.nutritionLabel}>Carbs</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{analysisResult.fat_g.toFixed(1)}g</Text>
                <Text style={styles.nutritionLabel}>Fat</Text>
              </View>
            </View>
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>Confidence:</Text>
              <Text style={[
                styles.confidenceValue,
                { color: analysisResult.confidence_score >= 0.8 ? Colors.secondary : analysisResult.confidence_score >= 0.5 ? Colors.warning : Colors.error }
              ]}>
                {(analysisResult.confidence_score * 100).toFixed(0)}%
              </Text>
            </View>
          </View>

          <View style={styles.itemsCard}>
            <Text style={styles.cardTitle}>Detected Items</Text>
            {analysisResult.items.map((item: any, index: number) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPortion}>~{item.portion_estimate_g.toFixed(0)}g</Text>
                </View>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>{(item.probability * 100).toFixed(0)}%</Text>
                </View>
              </View>
            ))}
          </View>

          {analysisResult.recommendations.length > 0 && (
            <View style={styles.recommendationsCard}>
              <Text style={styles.cardTitle}>Recommendations</Text>
              {analysisResult.recommendations.map((rec: string, index: number) => (
                <View key={index} style={styles.recommendationItem}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.secondary} />
                  <Text style={styles.recommendationText}>{rec}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.retakeButton} onPress={retake}>
              <Ionicons name="camera" size={20} color={Colors.text} />
              <Text style={styles.retakeButtonText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.buttonDisabled]}
              onPress={saveMeal}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={Colors.background} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color={Colors.background} />
                  <Text style={styles.saveButtonText}>Save Meal</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Preview screen (after capture, before analyze)
  if (capturedImage && !analysisResult) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.fullImage} />
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.previewButton} onPress={retake}>
              <Text style={styles.previewButtonText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.previewButton, styles.analyzeButton]} onPress={analyzeMeal}>
              <Text style={styles.analyzeButtonText}>Analyze</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Camera view
  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} facing="back">
        <SafeAreaView style={styles.cameraOverlay} edges={['top', 'bottom']}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.guideContainer}>
            <View style={styles.guideBox} />
            <Text style={styles.guideText}>Center your meal in the frame</Text>
          </View>

          <View style={styles.tagSelector}>
            {MEAL_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag.value}
                style={[styles.tagButton, selectedTag === tag.value && styles.tagButtonActive]}
                onPress={() => setSelectedTag(tag.value)}
              >
                <Ionicons
                  name={tag.icon as any}
                  size={18}
                  color={selectedTag === tag.value ? Colors.background : Colors.text}
                />
                <Text style={[styles.tagText, selectedTag === tag.value && styles.tagTextActive]}>
                  {tag.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.galleryButton} onPress={pickImageFromGallery}>
              <Ionicons name="images" size={28} color={Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            <View style={{ width: 64 }} />
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permissionTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginTop: 24 },
  permissionText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', marginTop: 16, marginBottom: 32, lineHeight: 24 },
  button: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 32, marginBottom: 16 },
  buttonText: { fontSize: 16, fontWeight: '600', color: Colors.background },
  cancelText: { fontSize: 14, color: Colors.textSecondary, marginTop: 8 },
  
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'space-between' },
  topBar: { padding: 20 },
  closeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  guideContainer: { alignItems: 'center' },
  guideBox: { width: 280, height: 280, borderWidth: 3, borderColor: Colors.primary, borderRadius: 20, backgroundColor: 'transparent' },
  guideText: { color: Colors.text, fontSize: 14, marginTop: 16, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  tagSelector: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  tagButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  tagButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tagText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  tagTextActive: { color: Colors.background },
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 40 },
  galleryButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  captureButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'transparent', borderWidth: 4, borderColor: Colors.text, alignItems: 'center', justifyContent: 'center' },
  captureButtonInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.text },
  
  previewContainer: { flex: 1, position: 'relative' },
  fullImage: { width: '100%', height: '100%' },
  previewActions: { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 20, paddingHorizontal: 40 },
  previewButton: { flex: 1, backgroundColor: Colors.cardBackground, borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  previewButtonText: { fontSize: 16, fontWeight: '600', color: Colors.text },
  analyzeButton: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  analyzeButtonText: { fontSize: 16, fontWeight: '600', color: Colors.background },
  
  analyzingContainer: { flex: 1, position: 'relative' },
  analyzingImage: { width: '100%', height: '100%' },
  analyzingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  analyzingText: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 20, textAlign: 'center' },
  analyzingSubtext: { fontSize: 14, color: Colors.textSecondary, marginTop: 8, textAlign: 'center' },
  
  scrollContent: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  previewImage: { width: '100%', height: 250, marginBottom: 20 },
  warningBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.warning + '20', borderRadius: 12, padding: 16, marginHorizontal: 20, marginBottom: 20, gap: 12 },
  warningText: { flex: 1, fontSize: 14, color: Colors.warning, lineHeight: 20 },
  
  nutritionCard: { backgroundColor: Colors.cardBackground, marginHorizontal: 20, borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 16 },
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  nutritionItem: { width: '47%', backgroundColor: Colors.surface, borderRadius: 12, padding: 16, alignItems: 'center' },
  nutritionValue: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  nutritionLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  confidenceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  confidenceLabel: { fontSize: 14, color: Colors.textSecondary },
  confidenceValue: { fontSize: 16, fontWeight: 'bold' },
  
  itemsCard: { backgroundColor: Colors.cardBackground, marginHorizontal: 20, borderRadius: 16, padding: 20, marginBottom: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  itemPortion: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  confidenceBadge: { backgroundColor: Colors.primary + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  confidenceText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  
  recommendationsCard: { backgroundColor: Colors.cardBackground, marginHorizontal: 20, borderRadius: 16, padding: 20, marginBottom: 16 },
  recommendationItem: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  recommendationText: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 20 },
  
  buttonRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 8 },
  retakeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardBackground, borderRadius: 12, paddingVertical: 16, gap: 8, borderWidth: 1, borderColor: Colors.border },
  retakeButtonText: { fontSize: 16, fontWeight: '600', color: Colors.text },
  saveButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, gap: 8 },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: Colors.background },
});
