import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function ScanScreen() {
  const router = useRouter();

  useEffect(() => {
    // Immediately redirect to camera-scan
    router.replace('/(main)/camera-scan');
  }, []);

  return null;
}