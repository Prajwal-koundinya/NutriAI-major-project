import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class NotificationService {
  static async requestPermissions(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    return finalStatus === 'granted';
  }

  static async scheduleDailySummaryNotification(): Promise<void> {
    try {
      // Cancel existing daily summary notifications
      const existingNotifications = await Notifications.getAllScheduledNotificationsAsync();
      for (const notification of existingNotifications) {
        if (notification.content.data?.type === 'daily_summary') {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }

      // Schedule notification for 8:30 PM daily
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📊 Your Daily Summary is Ready!',
          body: 'Check your nutrition progress for today',
          data: { type: 'daily_summary' },
          sound: true,
        },
        trigger: {
          hour: 20, // 8 PM
          minute: 30,
          repeats: true,
        },
      });

      console.log('Daily summary notification scheduled');
    } catch (error) {
      console.error('Failed to schedule notification:', error);
    }
  }

  static async sendDailySummaryNotification(summary: {
    totalCalories: number;
    calorieTarget: number;
    proteinProgress: number;
    proteinTarget: number;
    insight: string;
  }): Promise<void> {
    const surplus = summary.totalCalories - summary.calorieTarget;
    const deficitOrSurplus = surplus > 0 
      ? `+${surplus.toFixed(0)} surplus` 
      : `${Math.abs(surplus).toFixed(0)} deficit`;
    
    const proteinPercent = ((summary.proteinProgress / summary.proteinTarget) * 100).toFixed(0);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎯 Daily Nutrition Summary',
        body: `${summary.totalCalories.toFixed(0)} kcal (${deficitOrSurplus}) • Protein: ${proteinPercent}%\n${summary.insight}`,
        data: { type: 'summary_detail', summary },
        sound: true,
      },
      trigger: null, // Send immediately
    });
  }

  static async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  static async setupNotificationListener(
    callback: (notification: Notifications.Notification) => void
  ): Promise<Notifications.Subscription> {
    return Notifications.addNotificationReceivedListener(callback);
  }

  static async setupNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Promise<Notifications.Subscription> {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }
}
