import type {MessageApi, MessageInput, MessageOptions, MessageType} from './types';

type MessageDispatcher = (message: MessageInput) => string;

let dispatcher: MessageDispatcher | null = null;
const pendingMessages: MessageInput[] = [];

function createMessage(type: MessageType, text: string, options?: MessageOptions) {
  const input: MessageInput = {
    duration: options?.duration,
    text,
    type
  };

  if (!dispatcher) {
    pendingMessages.push(input);
    return '';
  }

  return dispatcher(input);
}

export const message: MessageApi = {
  error: (text, options) => createMessage('error', text, options),
  success: (text, options) => createMessage('success', text, options),
  warning: (text, options) => createMessage('warning', text, options)
};

export function setMessageDispatcher(nextDispatcher: MessageDispatcher | null) {
  dispatcher = nextDispatcher;

  if (!dispatcher) {
    return;
  }

  while (pendingMessages.length) {
    const pendingMessage = pendingMessages.shift();
    if (pendingMessage) {
      dispatcher(pendingMessage);
    }
  }
}
