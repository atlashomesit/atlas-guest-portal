import { DateTime } from 'luxon';

export const getIstStartOfDay = (date: Date = new Date()) =>
  DateTime.fromJSDate(date).setZone('Asia/Kolkata').startOf('day').toJSDate();

export const getIstCalendarDate = (date: Date = new Date()) => {
  const istDate = DateTime.fromJSDate(date).setZone('Asia/Kolkata');
  return new Date(istDate.year, istDate.month - 1, istDate.day);
};
