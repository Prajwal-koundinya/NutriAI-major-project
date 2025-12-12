import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';

export default function InsightsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="analytics" size={80} color={Colors.primary} />
        <Text style={styles.title}>Insights & Trends</Text>
        <Text style={styles.subtitle}>Track more meals to see insights</Text>
        <Text style={styles.description}>After logging meals for a few days, you'll see charts and trends about your nutrition patterns.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginTop: 24 },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginTop: 8 },
  description: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 16, lineHeight: 20 },
});