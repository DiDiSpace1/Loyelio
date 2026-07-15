'use client';

import {MessageView} from './MessageView';
import type {MessageItem} from './types';

export function MessageContainer({messages, onClose}: {messages: MessageItem[]; onClose: (id: string) => void}) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100000] grid w-[min(380px,calc(100vw-32px))] gap-3 sm:right-6 sm:top-6" aria-live="polite" aria-relevant="additions removals">
      {messages.map((item) => (
        <MessageView item={item} key={item.id} onClose={onClose} />
      ))}
    </div>
  );
}
