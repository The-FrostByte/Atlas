import { formatISO } from 'date-fns';

export const getUtcNow = () => new Date().toISOString();

export const toUtcIso = (date = new Date()) => {
  return typeof date === 'string' ? date : date.toISOString();
};