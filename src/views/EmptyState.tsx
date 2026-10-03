import { useState } from 'react';
import { Button } from '../components/Button';
import { PALETTE } from '../domain/color';
import { today } from '../domain/dates';
import { addDemoTeam } from '../domain/demo';
import { count } from '../domain/format';
import { addPeople, parseNames } from '../domain/manage';
import { scheduleStore, useScheduleStore } from '../store/useScheduleStore';
import styles from './EmptyState.module.css';

/** Bars for the decorative grid: [row, start column, span, palette index]. */
const BARS: readonly [number, number, number, number][] = [
  [0, 0, 3, 0],
  [0, 4, 2, 2],
  [1, 1, 4, 1],
  [2, 0, 2, 3],
  [2, 3, 3, 7],
  [3, 2, 3, 8],
];

/** First run: ask for names, or offer a demo team. */
export function EmptyState() {
  const [names, setNames] = useState('');
  const parsed = parseNames(names);
  const { commit } = scheduleStore.getState();
  const readOnly = useScheduleStore((s) => s.readOnly);

  const add = () => {
    if (parsed.length === 0) return;
    commit('add people', (changes) => addPeople(changes, parsed), {
      toast: `Added ${count(parsed.length, 'person', 'people')}. Pick a shift in the palette and paint their days.`,
    });
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.card} aria-labelledby="empty-title">
        <div className={styles.art} aria-hidden="true">
          {BARS.map(([row, start, span, color], i) => (
            <span
              key={i}
              className={styles.bar}
              style={{
                gridRow: row + 1,
                gridColumn: `${start + 1} / span ${span}`,
                background: PALETTE[color],
              }}
            />
          ))}
        </div>
        {readOnly ? (
          <>
            <h2 id="empty-title" className={styles.title}>
              Nobody is on this schedule yet
            </h2>
            <p className={styles.text}>People and shifts show up here as soon as an editor adds them.</p>
          </>
        ) : (
          <EditorStart names={names} setNames={setNames} parsed={parsed} add={add} commit={commit} />
        )}
      </section>
    </div>
  );
}

function EditorStart({
  names,
  setNames,
  parsed,
  add,
  commit,
}: {
  names: string;
  setNames(names: string): void;
  parsed: string[];
  add(): void;
  commit: ReturnType<typeof scheduleStore.getState>['commit'];
}) {
  return (
    <>
      <h2 id="empty-title" className={styles.title}>
        Who's on the team?
      </h2>
      <p className={styles.text}>Add one name per line. You can change colors, tags and order later.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <label htmlFor="empty-names" className="visually-hidden">
          Names, one per line
        </label>
        <textarea
          id="empty-names"
          className={styles.names}
          rows={5}
          value={names}
          placeholder={'Ana Ruiz\nBen Okafor\nChloe Park'}
          onChange={(e) => setNames(e.target.value)}
        />
        <div className={styles.actions}>
          <Button type="submit" variant="primary" disabled={parsed.length === 0}>
            {parsed.length > 1 ? `Add ${count(parsed.length, 'person', 'people')}` : 'Add people'}
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              commit('add demo team', (changes) => addDemoTeam(changes, today()), {
                toast: 'Added a demo team. Remove it any time in Settings.',
              })
            }
          >
            Try it with a demo team
          </Button>
        </div>
      </form>
    </>
  );
}
