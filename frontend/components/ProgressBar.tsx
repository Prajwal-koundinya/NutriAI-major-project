import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Colors from '../constants/Colors';

interface ProgressBarProps {
  progress: number;
  max: number;
  label: string;
  color?: string;
  showValues?: boolean;
}

export default function ProgressBar({
  progress,
  max,
  label,
  color = Colors.secondary,
  showValues = true,
}: ProgressBarProps) {
  const animatedWidth = useSharedValue(0);

  useEffect(() => {
    animatedWidth.value = withTiming((progress / max) * 100, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, max]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${Math.min(animatedWidth.value, 100)}%`,
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {showValues && (
          <Text style={styles.values}>
            {progress.toFixed(0)}g / {max}g
          </Text>
        )}
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.progress,
            { backgroundColor: color },
            animatedStyle,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  values: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  track: {
    height: 12,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    borderRadius: 6,
  },
});
