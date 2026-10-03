import { useState } from 'react';
import { useAccount } from '../../auth/account';
import { ACCESS_LABELS, usePeopleAccess, type PersonAccess } from '../../auth/peopleAccess';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Field } from '../../components/forms';
import { count } from '../../domain/format';
import { addPeople, moveInOrder, parseNames } from '../../domain/manage';
import { selectEmployees } from '../../store/derived';
import { scheduleStore, useScheduleStore } from '../../store/useScheduleStore';
import styles from './manage.module.css';

export function PeopleTab() {
  const employees = useScheduleStore(selectEmployees);
  const tags = useScheduleStore((s) => s.data.tags);
  const { access } = usePeopleAccess();
  const isOwner = !!useAccount()?.repository.isOwner;
  const [names, setNames] = useState('');
  const parsed = parseNames(names);
  const { commit, openSheet } = scheduleStore.getState();

  const add = () => {
    if (parsed.length === 0) return;
    commit('add people', (changes) => addPeople(changes, parsed), {
      toast: `Added ${count(parsed.length, 'person', 'people')}.`,
    });
    setNames('');
  };

  return (
    <>
      <ul className={styles.list}>
        {employees.length === 0 && <li className={styles.empty}>No one yet. Add names below.</li>}
        {employees.map((employee, index) => (
          <li key={employee.id} className={styles.item}>
            <Avatar name={employee.name} color={employee.color} />
            <div className={styles.main}>
              <span className={styles.name}>{employee.name}</span>
              <span className={styles.meta}>
                {employee.tags
                  .map((id) => tags[id]?.name)
                  .filter(Boolean)
                  .join(', ') || 'No tags'}
                {employee.demo ? ' · Demo' : ''}
              </span>
              {access && (isOwner || access.byPerson[employee.id]) && (
                <SignInLine access={access.byPerson[employee.id]} />
              )}
            </div>
            <div className={styles.actions}>
              <Button
                icon="arrowUp"
                iconOnly
                variant="ghost"
                size="sm"
                disabled={index === 0}
                onClick={() => commit('reorder people', (c) => moveInOrder(c, 'employees', employee.id, -1))}
              >
                Move {employee.name} up
              </Button>
              <Button
                icon="arrowDown"
                iconOnly
                variant="ghost"
                size="sm"
                disabled={index === employees.length - 1}
                onClick={() => commit('reorder people', (c) => moveInOrder(c, 'employees', employee.id, 1))}
              >
                Move {employee.name} down
              </Button>
              <Button size="sm" onClick={() => openSheet({ kind: 'person', employeeId: employee.id })}>
                Edit
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Field label="Add people" hint="One name per line. Paste a list to add many at once.">
        {(id) => (
          <textarea
            id={id}
            rows={3}
            value={names}
            placeholder={'Ana Ruiz\nBen Okafor'}
            onChange={(e) => setNames(e.target.value)}
          />
        )}
      </Field>
      <Button variant="primary" icon="plus" onClick={add} disabled={parsed.length === 0}>
        {parsed.length > 1 ? `Add ${count(parsed.length, 'person', 'people')}` : 'Add person'}
      </Button>
    </>
  );
}

function SignInLine({ access }: { access: PersonAccess | undefined }) {
  return (
    <span className={styles.meta}>
      {access
        ? `${access.email} · ${access.owner ? 'Owner' : ACCESS_LABELS[access.role]}${access.invited ? ' (invited)' : ''}`
        : 'No sign-in linked'}
    </span>
  );
}
