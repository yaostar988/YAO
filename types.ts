export interface User {
  id: string;
  name: string;
  avatar: string;
  isBot?: boolean;
}

export interface Attachment {
  type: 'image' | 'file';
  url: string; // Base64 data or URL
  name?: string;
  mimeType?: string;
  size?: number;
}

export interface Message {
  id: string;
  senderId: string;
  content: string; // Text content (optional if attachment exists)
  attachment?: Attachment;
  timestamp: number;
  type: 'text' | 'image' | 'file' | 'system';
  status?: 'sending' | 'sent' | 'error';
}

export interface ChatSession {
  id: string;
  contactId: string;
  messages: Message[];
  unreadCount: number;
  lastMessageTimestamp: number;
}

export enum Tab {
  CHATS = 'chats',
  CONTACTS = 'contacts',
  DISCOVER = 'discover',
  ME = 'me',
}