import { textOn } from '../domain/color';
import { initials } from '../domain/format';
import { Icon } from './Icon';
import styles from './Avatar.module.css';

interface AvatarProps {
  name: string;
  color: string;
  selected?: boolean;
  size?: 'sm' | 'md';
}

/** A circle in the person's color with their initials. Selected shows a ring and a check. */
export function Avatar({ name, color, selected = false, size = 'md' }: AvatarProps) {
  return (
    <span
      className={[styles.avatar, size === 'sm' && styles.small, selected && styles.selected]
        .filter(Boolean)
        .join(' ')}
      style={{ background: color, color: textOn(color) }}
      aria-hidden="true"
    >
      {initials(name)}
      {selected && (
        <span className={styles.check}>
          <Icon name="check" size={10} strokeWidth={3.5} />
        </span>
      )}
    </span>
  );
}
