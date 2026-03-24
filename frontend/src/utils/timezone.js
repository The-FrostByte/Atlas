/**
 * UTC/Timezone Utility Functions
 * 
 * All timestamps are stored in UTC in the database.
 * Frontend converts local time → UTC before sending to backend.
 * Frontend converts UTC → local time for display.
 */

/**
 * Get the user's timezone identifier
 * @returns {string} Timezone identifier (e.g., 'America/New_York', 'Asia/Kolkata')
 */
export const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Get the user's timezone offset in hours
 * @returns {number} Offset in hours (e.g., -5 for EST, +5.5 for IST)
 */
export const getTimezoneOffsetHours = () => {
  return -new Date().getTimezoneOffset() / 60;
};

/**
 * Convert a local date/time to UTC ISO string for API payload
 * @param {string} localDateStr - Local date string (YYYY-MM-DD)
 * @param {string} localTimeStr - Local time string (HH:MM) - optional, defaults to 00:00
 * @returns {string} UTC ISO 8601 string with Z suffix
 */
export const localToUTC = (localDateStr, localTimeStr = '00:00') => {
  if (!localDateStr) return null;
  
  try {
    // Construct local datetime
    const [year, month, day] = localDateStr.split('-').map(Number);
    const [hours, minutes] = localTimeStr.split(':').map(Number);
    
    // Create date in local timezone
    const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    
    // Convert to UTC ISO string
    return localDate.toISOString();
  } catch (e) {
    console.error('Error converting local to UTC:', e);
    return null;
  }
};

/**
 * Convert a local date with end-of-day time to UTC for due dates
 * @param {string} localDateStr - Local date string (YYYY-MM-DD)
 * @returns {string} UTC ISO 8601 string for end of day in user's timezone
 */
export const localDateToUTCEndOfDay = (localDateStr) => {
  if (!localDateStr) return null;
  
  try {
    const [year, month, day] = localDateStr.split('-').map(Number);
    
    // Set to end of day (23:59:59) in local timezone
    const localDate = new Date(year, month - 1, day, 23, 59, 59, 0);
    
    return localDate.toISOString();
  } catch (e) {
    console.error('Error converting local date to UTC end of day:', e);
    return null;
  }
};

/**
 * Convert a UTC ISO string to local Date object
 * @param {string} utcString - UTC ISO 8601 string
 * @returns {Date} Local Date object
 */
export const utcToLocalDate = (utcString) => {
  if (!utcString) return null;
  
  try {
    return new Date(utcString);
  } catch (e) {
    console.error('Error converting UTC to local date:', e);
    return null;
  }
};

/**
 * Format a UTC string for display in user's local timezone
 * @param {string} utcString - UTC ISO 8601 string
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted local datetime string
 */
export const formatUTCToLocal = (utcString, options = {}) => {
  if (!utcString) return '';

  try {
    const date = new Date(utcString);

    // If user provides dateStyle or timeStyle, we should use those 
    // as they are newer and more concise.
    if (options.dateStyle || options.timeStyle) {
      return date.toLocaleString(undefined, {
        timeZone: getUserTimezone(),
        ...options
      });
    }

    // Default fallback if no specific styles are provided
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: getUserTimezone()
    };

    return date.toLocaleString(undefined, { ...defaultOptions, ...options });
  } catch (e) {
    console.error('Error formatting UTC to local:', e);
    return utcString;
  }
};
/**
 * Format a UTC string to local date only (no time)
 * @param {string} utcString - UTC ISO 8601 string
 * @returns {string} Formatted local date string
 */
export const formatUTCToLocalDate = (utcString) => {
  return formatUTCToLocal(utcString, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: undefined,
    minute: undefined
  });
};

/**
 * Format a UTC string to local time only
 * @param {string} utcString - UTC ISO 8601 string
 * @returns {string} Formatted local time string
 */
export const formatUTCToLocalTime = (utcString) => {
  return formatUTCToLocal(utcString, {
    year: undefined,
    month: undefined,
    day: undefined,
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Get local date string (YYYY-MM-DD) from UTC string for form inputs
 * @param {string} utcString - UTC ISO 8601 string
 * @returns {string} Local date string in YYYY-MM-DD format
 */
export const utcToLocalDateInput = (utcString) => {
  if (!utcString) return '';
  
  try {
    const date = new Date(utcString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error('Error converting UTC to local date input:', e);
    return '';
  }
};

/**
 * Get local time string (HH:MM) from UTC string for form inputs
 * @param {string} utcString - UTC ISO 8601 string
 * @returns {string} Local time string in HH:MM format
 */
export const utcToLocalTimeInput = (utcString) => {
  if (!utcString) return '';
  
  try {
    const date = new Date(utcString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (e) {
    console.error('Error converting UTC to local time input:', e);
    return '';
  }
};

/**
 * Convert local time (HH:MM) to UTC time (HH:MM) for digest settings
 * @param {string} localTimeStr - Local time string (HH:MM)
 * @returns {string} UTC time string (HH:MM)
 */
export const localTimeToUTCTime = (localTimeStr) => {
  if (!localTimeStr) return localTimeStr;
  
  try {
    const [hours, minutes] = localTimeStr.split(':').map(Number);
    
    // Create a date today at that local time
    const today = new Date();
    today.setHours(hours, minutes, 0, 0);
    
    // Get UTC hours/minutes
    const utcHours = String(today.getUTCHours()).padStart(2, '0');
    const utcMinutes = String(today.getUTCMinutes()).padStart(2, '0');
    
    return `${utcHours}:${utcMinutes}`;
  } catch (e) {
    console.error('Error converting local time to UTC time:', e);
    return localTimeStr;
  }
};

/**
 * Convert UTC time (HH:MM) to local time (HH:MM) for digest settings display
 * @param {string} utcTimeStr - UTC time string (HH:MM)
 * @returns {string} Local time string (HH:MM)
 */
export const utcTimeToLocalTime = (utcTimeStr) => {
  if (!utcTimeStr) return utcTimeStr;
  
  try {
    const [hours, minutes] = utcTimeStr.split(':').map(Number);
    
    // Create a UTC date today at that time
    const today = new Date();
    today.setUTCHours(hours, minutes, 0, 0);
    
    // Get local hours/minutes
    const localHours = String(today.getHours()).padStart(2, '0');
    const localMinutes = String(today.getMinutes()).padStart(2, '0');
    
    return `${localHours}:${localMinutes}`;
  } catch (e) {
    console.error('Error converting UTC time to local time:', e);
    return utcTimeStr;
  }
};

/**
 * Check if a UTC timestamp is in the past relative to current local time
 * @param {string} utcString - UTC ISO 8601 string
 * @returns {boolean} True if the timestamp is in the past
 */
export const isOverdue = (utcString) => {
  if (!utcString) return false;
  
  try {
    const dueDate = new Date(utcString);
    return dueDate < new Date();
  } catch (e) {
    return false;
  }
};

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 * @param {string} utcString - UTC ISO 8601 string
 * @returns {string} Relative time string
 */
export const getRelativeTime = (utcString) => {
  if (!utcString) return '';
  
  try {
    const date = new Date(utcString);
    const now = new Date();
    const diffMs = date - now;
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMs < 0) {
      // Past
      const absDiffHours = Math.abs(diffHours);
      const absDiffDays = Math.abs(diffDays);
      
      if (absDiffHours < 1) return 'just now';
      if (absDiffHours < 24) return `${absDiffHours}h overdue`;
      return `${absDiffDays}d overdue`;
    } else {
      // Future
      if (diffHours < 1) return 'due soon';
      if (diffHours < 24) return `${diffHours}h left`;
      return `${diffDays}d left`;
    }
  } catch (e) {
    return '';
  }
};

/**
 * Get current UTC time as ISO string
 * @returns {string} Current UTC time in ISO 8601 format
 */
export const getCurrentUTC = () => {
  return new Date().toISOString();
};

/**
 * Convert local datetime-local input value to UTC ISO string
 * @param {string} datetimeLocalStr - datetime-local value (YYYY-MM-DDTHH:mm)
 * @returns {string} UTC ISO 8601 string
 */
export const localDateTimeToUTC = (datetimeLocalStr) => {
  if (!datetimeLocalStr) return null;
  
  try {
    // datetime-local gives us format: "2025-01-15T14:30"
    const localDate = new Date(datetimeLocalStr);
    return localDate.toISOString();
  } catch (e) {
    console.error('Error converting local datetime to UTC:', e);
    return null;
  }
};

/**
 * Convert UTC ISO string to datetime-local input format
 * @param {string} utcString - UTC ISO 8601 string
 * @returns {string} datetime-local format (YYYY-MM-DDTHH:mm)
 */
export const utcToLocalDateTimeInput = (utcString) => {
  if (!utcString) return '';
  
  try {
    const date = new Date(utcString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (e) {
    console.error('Error converting UTC to local datetime input:', e);
    return '';
  }
};

/**
 * Format a UTC string for display with both date and time
 * @param {string} utcString - UTC ISO 8601 string
 * @returns {string} Formatted local datetime string
 */
export const formatUTCToLocalDateTime = (utcString) => {
  return formatUTCToLocal(utcString, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Get today's date in local timezone as YYYY-MM-DD
 * @returns {string} Today's local date
 */
export const getTodayLocal = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
