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

export function normalizeTeamName(name: string): string {
  if (!name) return '';
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function getBrazilDateTime(dateStr: string, timeStr: string): { date: string, time: string } {
  if (!dateStr) return { date: '', time: '' };
  
  const dateObj = parseMatchDateTime(dateStr, timeStr);
  
  const optionsDate: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  
  const optionsTime: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };

  const formatterDate = new Intl.DateTimeFormat('en-CA', optionsDate);
  const formatterTime = new Intl.DateTimeFormat('pt-BR', optionsTime);

  const formattedDate = formatterDate.format(dateObj);
  const formattedTime = formatterTime.format(dateObj);

  return { date: formattedDate, time: formattedTime };
}

export function mapMatchesToBrazil(matches: any[]): any[] {
  if (!matches) return [];
  return matches.map(m => {
    const { date: brDate, time: brTime } = getBrazilDateTime(m.date, m.time);
    return {
      ...m,
      date: brDate,
      time: `${brTime} UTC-3`
    };
  });
}


