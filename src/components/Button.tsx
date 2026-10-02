import type { ComponentProps, ReactNode } from 'react';
import styles from './Button.module.css';
import { Icon, type IconName } from './Icon';

type Variant = 'default' | 'primary' | 'ghost' | 'danger' | 'dangerSolid';

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: IconName;
  iconAfter?: IconName;
  /** Hides the text label on narrow screens. The label stays as the accessible name. */
  collapseLabel?: boolean;
  /** Shows only the icon; children become the accessible name. */
  iconOnly?: boolean;
  badge?: ReactNode;
}

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  iconAfter,
  collapseLabel = false,
  iconOnly = false,
  badge,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    size === 'sm' && styles.small,
    iconOnly && styles.iconOnly,
    collapseLabel && styles.collapsible,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children !== undefined && (
        <span className={iconOnly ? 'visually-hidden' : styles.label}>{children}</span>
      )}
      {badge !== undefined && badge !== null && badge !== false && (
        <span className={styles.badge}>{badge}</span>
      )}
      {iconAfter && <Icon name={iconAfter} size={16} className={styles.after} />}
    </button>
  );
}
