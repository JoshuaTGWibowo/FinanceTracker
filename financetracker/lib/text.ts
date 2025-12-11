export const truncateWords = (text: string, limit: number): string => {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  const words = trimmed.split(/\s+/);
  if (words.length <= limit) {
    return trimmed;
  }

  return `${words.slice(0, limit).join(" ")}...`;
};

/**
 * Format a date string or Date object according to the specified format
 * @param date - Date string (ISO format) or Date object
 * @param format - Date format preference ('dd/mm/yyyy' or 'mm/dd/yyyy')
 * @returns Formatted date string
 */
export const formatDate = (date: string | Date, format: 'dd/mm/yyyy' | 'mm/dd/yyyy' = 'dd/mm/yyyy'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  
  return format === 'dd/mm/yyyy' ? `${day}/${month}/${year}` : `${month}/${day}/${year}`;
};
