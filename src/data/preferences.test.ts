import { describe, expect, it } from 'vitest';
import { memoryStorage } from '../testing/memoryStorage';
import { PREFERENCES_KEY, loadPreferences, savePreferences } from './preferences';

describe('preferences', () => {
  it('defaults to the week view and the system theme', () => {
    expect(loadPreferences(memoryStorage())).toEqual({ view: 'week', theme: 'system' });
  });

  it('round-trips saved values', () => {
    const storage = memoryStorage();
    savePreferences({ view: 'month', theme: 'dark' }, storage);
    expect(loadPreferences(storage)).toEqual({ view: 'month', theme: 'dark' });
  });

  it('ignores unknown values and broken JSON', () => {
    expect(loadPreferences(memoryStorage({ [PREFERENCES_KEY]: '{"view":"year","theme":"pink"}' }))).toEqual({
      view: 'week',
      theme: 'system',
    });
    expect(loadPreferences(memoryStorage({ [PREFERENCES_KEY]: '{oops' }))).toEqual({
      view: 'week',
      theme: 'system',
    });
  });
});
