import { ReactNode } from 'react';
import './Panel.css';

export type PanelVariant = 'default' | 'raised' | 'inset';

interface PanelProps {
  children: ReactNode;
  variant?: PanelVariant;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
  noPadding?: boolean;
}

export function Panel({
  children,
  variant = 'default',
  className = '',
  header,
  footer,
  noPadding = false,
}: PanelProps) {
  return (
    <div className={`panel panel--${variant} ${className}`}>
      {header && <div className="panel-header">{header}</div>}
      <div className={`panel-content ${noPadding ? 'panel-content--no-padding' : ''}`}>
        {children}
      </div>
      {footer && <div className="panel-footer">{footer}</div>}
    </div>
  );
}
