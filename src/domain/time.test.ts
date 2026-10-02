import { describe, expect, it } from 'vitest';
import {
  endsNextDay,
  formatHour,
  formatHours,
  formatTime,
  formatTimeRange,
  fromMinutes,
  isHHMM,
  shiftHours,
  spanMinutes,
  toMinutes,
} from './time';

describe('time', () => {
  it('converts between HH:MM and minutes', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('07:30')).toBe(450);
    expect(fromMinutes(450)).toBe('07:30');
    expect(fromMinutes(1440 + 30)).toBe('00:30');
    expect(fromMinutes(-30)).toBe('23:30');
  });

  it('treats an end on or before the start as the next day', () => {
    expect(endsNextDay('22:00', '06:00')).toBe(true);
    expect(endsNextDay('08:00', '08:00')).toBe(true);
    expect(endsNextDay('08:00', '16:30')).toBe(false);
    expect(spanMinutes('22:00', '06:00')).toBe(480);
    expect(spanMinutes('08:00', '08:00')).toBe(1440);
  });

  it('computes hours as span minus break, never below zero', () => {
    expect(shiftHours('08:00', '16:30', 30)).toBe(8);
    expect(shiftHours('07:00', '17:30', 30)).toBe(10);
    expect(shiftHours('22:00', '06:00', 0)).toBe(8);
    expect(shiftHours('08:00', '08:30', 60)).toBe(0);
  });

  it('formats hour totals', () => {
    expect(formatHours(40)).toBe('40h');
    expect(formatHours(38.5)).toBe('38.5h');
    expect(formatHours(7.75)).toBe('7.75h');
  });

  it('formats 12-hour compact and long times', () => {
    expect(formatTime('07:00', 12)).toBe('7a');
    expect(formatTime('17:30', 12)).toBe('5:30p');
    expect(formatTime('12:00', 12)).toBe('12p');
    expect(formatTime('00:00', 12)).toBe('12a');
    expect(formatTime('07:00', 12, 'long')).toBe('7:00 AM');
    expect(formatTime('17:30', 12, 'long')).toBe('5:30 PM');
  });

  it('formats 24-hour times', () => {
    expect(formatTime('07:00', 24)).toBe('07:00');
    expect(formatTime('17:30', 24, 'long')).toBe('17:30');
  });

  it('formats ranges with an en dash', () => {
    expect(formatTimeRange('07:00', '17:30', 12)).toBe('7a–5:30p');
    expect(formatTimeRange('07:00', '17:30', 24)).toBe('07:00–17:30');
  });

  it('formats axis hours', () => {
    expect(formatHour(6, 12)).toBe('6a');
    expect(formatHour(12, 12)).toBe('12p');
    expect(formatHour(24, 12)).toBe('12a');
    expect(formatHour(6, 24)).toBe('06');
  });

  it('validates HH:MM', () => {
    expect(isHHMM('23:59')).toBe(true);
    expect(isHHMM('24:00')).toBe(false);
    expect(isHHMM('7:00')).toBe(false);
  });
});
