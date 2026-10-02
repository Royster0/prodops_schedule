import { describe, expect, it } from 'vitest';
import { createStarterData } from './seed';

describe('starter data', () => {
  const data = createStarterData();
  const templates = Object.values(data.templates).sort((a, b) => a.order - b.order);

  it('seeds the five templates in order', () => {
    expect(templates.map((t) => `${t.name} ${t.code} ${t.start}-${t.end} ${t.breakMins} ${t.color}`)).toEqual(
      [
        'Day D8 08:00-16:30 30 #2F5BD3',
        'Long day L10 07:00-17:30 30 #0E7C6B',
        'Early E8 06:00-14:30 30 #F2B517',
        'Late LT 14:00-22:30 30 #7B3FA0',
        'Half day H4 08:00-12:00 0 #D9B77A',
      ],
    );
  });

  it('seeds the four patterns, including the alternating two-week one', () => {
    const [day, longDay] = templates;
    const patterns = Object.values(data.patterns).sort((a, b) => a.order - b.order);
    expect(patterns.map((p) => p.name)).toEqual([
      '5×8, Mon to Fri',
      '4×10, Mon to Thu',
      '4×10, Tue to Fri',
      '4×10, alternating Mon and Fri off',
    ]);
    expect(patterns[0].days).toEqual([day.id, day.id, day.id, day.id, day.id, '', '']);
    const alternating = patterns[3];
    expect(alternating.length).toBe(14);
    expect(alternating.days.slice(0, 7)).toEqual([
      longDay.id,
      longDay.id,
      longDay.id,
      longDay.id,
      '',
      '',
      '',
    ]);
    expect(alternating.days.slice(7)).toEqual(['', longDay.id, longDay.id, longDay.id, longDay.id, '', '']);
  });

  it('seeds tags and settings but no people', () => {
    expect(Object.values(data.tags).map((t) => `${t.name} ${t.color}`)).toEqual([
      'Lead #C8412A',
      'Training #1677A8',
      'On call #4F7A28',
    ]);
    expect(data.settings).toEqual({
      title: 'Team schedule',
      weekStart: 1,
      clock: 12,
      dayStart: 5,
      dayEnd: 23,
    });
    expect(data.employees).toEqual({});
    expect(data.shifts).toEqual({});
  });
});
