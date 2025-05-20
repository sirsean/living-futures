// Hour in Eastern Time before which we check yesterday instead of today
// This handles late-finishing games that end after midnight ET
export const DEFAULT_DATE_CUTOFF_HOUR_ET = 6;

/**
 * Gets a date in Eastern Time, properly handling DST
 * @param date Date to convert to ET
 * @returns Date object for the date in ET
 */
export function getDateInET(date: Date): Date {
  // Format a date string in ET using Intl.DateTimeFormat
  // This properly handles DST transitions automatically
  const etDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', // Eastern Time zone
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  // Get the date parts
  const dateParts = etDateFormatter.formatToParts(date);
  
  // Extract the individual components
  const year = parseInt(dateParts.find(part => part.type === 'year')?.value || '0');
  const month = parseInt(dateParts.find(part => part.type === 'month')?.value || '0') - 1; // Months are 0-indexed in Date
  const day = parseInt(dateParts.find(part => part.type === 'day')?.value || '0');
  
  // Create a new date using ET date (but with local time)
  // We only care about the date part (YYYY-MM-DD), not the time
  return new Date(year, month, day);
}

/**
 * Gets today's date in Eastern Time, properly handling DST
 * @param referenceTime Optional reference time (defaults to now)
 * @returns Date object for today in ET
 */
export function getTodayInET(referenceTime?: Date): Date {
  return getDateInET(referenceTime || new Date());
}

/**
 * Gets yesterday's date in Eastern Time, properly handling DST
 * @param referenceTime Optional reference time (defaults to now)
 * @returns Date object for yesterday in ET
 */
export function getYesterdayInET(referenceTime?: Date): Date {
  const baseTime = referenceTime || new Date();
  const yesterday = new Date(baseTime);
  yesterday.setDate(yesterday.getDate() - 1);
  return getDateInET(yesterday);
}

/**
 * Gets the appropriate default date based on ET time
 * Before cutoff hour: use yesterday (to catch late-finishing games)
 * After cutoff hour: use today
 * @param currentTime Optional time to use (defaults to now) - useful for testing
 * @param cutoffHour Hour in ET before which to use yesterday (defaults to DEFAULT_DATE_CUTOFF_HOUR_ET)
 * @returns Object with date and explanation
 */
export function getDefaultSyncDate(currentTime?: Date, cutoffHour: number = DEFAULT_DATE_CUTOFF_HOUR_ET): { date: Date, explanation: string } {
  const now = currentTime || new Date();
  
  // Get current hour in ET
  const etTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false
  });
  const currentHourET = parseInt(etTimeFormatter.format(now));
  
  if (currentHourET < cutoffHour) {
    return {
      date: getYesterdayInET(now),
      explanation: `default: yesterday because current time ${currentHourET}:xx ET is before ${cutoffHour}AM cutoff - checking for late-finishing games`
    };
  } else {
    return {
      date: getTodayInET(now), 
      explanation: `default: today because current time ${currentHourET}:xx ET is after ${cutoffHour}AM cutoff`
    };
  }
}