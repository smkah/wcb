import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMatchDate(dateStr: string) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const monthIdx = parseInt(month, 10) - 1;
  return `${day} ${months[monthIdx] || ''}`;
}

export function formatMatchTime(timeStr: string) {
  if (!timeStr) return '';
  return timeStr.split(' ')[0];
}

export function parseMatchDateTime(dateStr: string, timeStr: string): Date {
  if (!dateStr) return new Date();
  
  const cleanedTime = (timeStr || '00:00').trim();
  const parts = cleanedTime.split(/\s+/);
  const timePart = parts[0]; // e.g. "20:00"
  const tzPart = parts[1];   // e.g. "UTC-6" or undefined
  
  let isoString = `${dateStr}T${timePart}`;
  
  if (tzPart) {
    const tzMatch = tzPart.match(/UTC([+-])(\d+)/i);
    if (tzMatch) {
      const sign = tzMatch[1];
      const hours = parseInt(tzMatch[2], 10);
      const formattedHours = String(hours).padStart(2, '0');
      isoString += `${sign}${formattedHours}:00`;
    } else if (tzPart.toUpperCase() === 'UTC') {
      isoString += 'Z';
    }
  } else {
    // If no timezone offset is specified, treat it as UTC to match database
    isoString += 'Z';
  }
  
  return new Date(isoString);
}

