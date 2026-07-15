'use client';

import type {MessageItem, MessageType} from './types';

const messageStyles: Record<
  MessageType,
  {
    bar: string;
    icon: string;
    iconColor: string;
  }
> = {
  error: {
    bar: 'bg-[#ba1a1a]',
    icon: 'error',
    iconColor: 'text-[#ba1a1a]'
  },
  success: {
    bar: 'bg-[var(--accent)]',
    icon: 'check_circle',
    iconColor: 'text-[var(--accent)]'
  },
  warning: {
    bar: 'bg-[#b35a09]',
    icon: 'warning',
    iconColor: 'text-[#b35a09]'
  }
};

export function MessageView({item, onClose}: {item: MessageItem; onClose: (id: string) => void}) {
  const styles = messageStyles[item.type];

  return (
    <div
      className={`pointer-events-auto grid w-full grid-cols-[4px_1fr] overflow-hidden rounded-xl border border-white/70 bg-white/90 shadow-[0_16px_40px_rgb(23_29_28_/_14%)] backdrop-blur transition duration-200 ease-out ${
        item.open ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-2 scale-[0.98] opacity-0'
      }`}
      role={item.type === 'error' ? 'alert' : 'status'}
    >
      <div className={styles.bar} />
      <div className="flex min-w-0 items-start gap-3 px-4 py-3">
        <span className={`material-symbols-outlined mt-0.5 text-[20px] ${styles.iconColor}`}>{styles.icon}</span>
        <p className="min-w-0 flex-1 text-sm font-medium leading-6 text-[#171d1c]">{item.text}</p>
        <button className="focus-ring -mr-1 rounded-md p-1 text-[#53615f] transition hover:bg-[#eef2f0] hover:text-[#171d1c]" onClick={() => onClose(item.id)} type="button" aria-label="Fermer">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>
  );
}
