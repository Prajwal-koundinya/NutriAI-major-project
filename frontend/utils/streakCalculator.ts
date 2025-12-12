import { format, startOfDay, differenceInDays } from 'date-fns';

interface MealEntry {
  timestamp: string | Date;
  [key: string]: any;
}

/**
 * Computes the current streak of consecutive days with at least one meal logged
 * @param mealEntries Array of meal entries from history
 * @param timezone User's timezone (e.g., 'Asia/Kolkata')
 * @returns Number of consecutive days including today with at least one meal
 */
export function computeStreak(mealEntries: MealEntry[], timezone: string = 'Asia/Kolkata'): number {
  if (!mealEntries || mealEntries.length === 0) {
    return 0;
  }

  // Convert all meal timestamps to calendar dates in user's timezone
  const mealDates = mealEntries
    .map((meal) => {
      const date = typeof meal.timestamp === 'string' ? new Date(meal.timestamp) : meal.timestamp;
      return startOfDay(date);
    })
    .map((date) => format(date, 'yyyy-MM-dd'))
    .sort((a, b) => b.localeCompare(a)); // Sort descending (newest first)

  // Get unique dates
  const uniqueDates = Array.from(new Set(mealDates)).sort((a, b) => b.localeCompare(a));

  if (uniqueDates.length === 0) {
    return 0;
  }

  // Get today's date
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
  
  // Check if today has a meal
  if (!uniqueDates.includes(today)) {
    return 0;
  }

  // Count consecutive days from today backwards
  let streak = 1; // Today counts as 1
  let checkDate = new Date(today);

  for (let i = 1; i < uniqueDates.length; i++) {
    // Move back one day
    checkDate.setDate(checkDate.getDate() - 1);
    const expectedDate = format(startOfDay(checkDate), 'yyyy-MM-dd');

    if (uniqueDates[i] === expectedDate) {
      streak++;
    } else {
      // Gap found, streak broken
      break;
    }
  }

  return streak;
}

/**
 * Get appropriate streak message based on streak value
 */
export function getStreakMessage(streak: number): string {
  if (streak === 0) {
    return "No streak yet — log your first meal today!";
  } else if (streak === 1) {
    return "1-day streak — nice start!";
  } else {
    return `${streak}-day streak — keep it up!`;
  }
}

/**
 * Get streak color based on value
 */
export function getStreakColor(streak: number): string {
  if (streak === 0) return '#6b7280'; // gray
  if (streak < 3) return '#f59e0b'; // orange
  if (streak < 7) return '#10b981'; // green
  return '#8b5cf6'; // purple for 7+ days
}
