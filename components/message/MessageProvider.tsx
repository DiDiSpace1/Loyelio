'use client';

import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';

import {MessageContainer} from './MessageContainer';
import {RouteMessageListener} from './RouteMessageListener';
import {setMessageDispatcher} from './message';
import type {MessageApi, MessageInput, MessageItem, MessageOptions, MessageType} from './types';

const DEFAULT_DURATION = 3000;
const EXIT_DURATION = 200;

const MessageContext = createContext<MessageApi | null>(null);

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function MessageProvider({children}: {children: React.ReactNode}) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const removeTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const close = useCallback(
    (id: string) => {
      removeTimer(id);
      setMessages((currentMessages) => currentMessages.map((item) => (item.id === id ? {...item, open: false} : item)));
      window.setTimeout(() => {
        setMessages((currentMessages) => currentMessages.filter((item) => item.id !== id));
      }, EXIT_DURATION);
    },
    [removeTimer]
  );

  const add = useCallback(
    ({duration = DEFAULT_DURATION, text, type}: MessageInput) => {
      const id = createId();
      const item: MessageItem = {
        duration,
        id,
        open: false,
        text,
        type
      };

      setMessages((currentMessages) => [...currentMessages, item]);
      window.requestAnimationFrame(() => {
        setMessages((currentMessages) => currentMessages.map((messageItem) => (messageItem.id === id ? {...messageItem, open: true} : messageItem)));
      });

      if (duration > 0) {
        timersRef.current.set(id, window.setTimeout(() => close(id), duration));
      }

      return id;
    },
    [close]
  );

  const createTypedMessage = useCallback((type: MessageType, text: string, options?: MessageOptions) => add({duration: options?.duration, text, type}), [add]);

  const api = useMemo<MessageApi>(
    () => ({
      error: (text, options) => createTypedMessage('error', text, options),
      success: (text, options) => createTypedMessage('success', text, options),
      warning: (text, options) => createTypedMessage('warning', text, options)
    }),
    [createTypedMessage]
  );

  useEffect(() => {
    const timers = timersRef.current;
    setMessageDispatcher(add);
    return () => {
      setMessageDispatcher(null);
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, [add]);

  return (
    <MessageContext.Provider value={api}>
      {children}
      <RouteMessageListener />
      <MessageContainer messages={messages} onClose={close} />
    </MessageContext.Provider>
  );
}

export function useMessage() {
  const context = useContext(MessageContext);

  if (!context) {
    throw new Error('useMessage must be used within MessageProvider.');
  }

  return context;
}
