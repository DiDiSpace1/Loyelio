export type MessageType = 'success' | 'error' | 'warning';

export type MessageOptions = {
  duration?: number;
};

export type MessageInput = MessageOptions & {
  text: string;
  type: MessageType;
};

export type MessageItem = MessageInput & {
  id: string;
  open: boolean;
};

export type MessageApi = {
  success: (text: string, options?: MessageOptions) => string;
  error: (text: string, options?: MessageOptions) => string;
  warning: (text: string, options?: MessageOptions) => string;
};
