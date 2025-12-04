import React from 'react';
import { ChatSession, User } from '../types';
import Avatar from './Avatar';

interface ChatListProps {
  sessions: ChatSession[];
  users: Record<string, User>;
  onSelectChat: (sessionId: string) => void;
  activeSessionId: string | null;
}

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
};

const ChatList: React.FC<ChatListProps> = ({ sessions, users, onSelectChat, activeSessionId }) => {
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-app-surface">
      {sessions.map((session) => {
        const user = users[session.contactId];
        const lastMsg = session.messages[session.messages.length - 1];
        const isActive = activeSessionId === session.id;

        if (!user) return null;

        let previewText = 'No messages';
        if (lastMsg) {
          if (lastMsg.type === 'image') previewText = '[Image]';
          else if (lastMsg.type === 'file') previewText = '[File]';
          else previewText = lastMsg.content;
        }

        return (
          <div
            key={session.id}
            onClick={() => onSelectChat(session.id)}
            className={`flex items-center p-4 cursor-pointer transition-all duration-200 border-b border-gray-50 ${
              isActive ? 'bg-indigo-50/60' : 'hover:bg-gray-50'
            }`}
          >
            <div className="relative">
              <Avatar src={user.avatar} alt={user.name} size="lg" shape="circle" />
              {session.unreadCount > 0 && (
                <div className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                  {session.unreadCount}
                </div>
              )}
            </div>
            
            <div className="ml-4 flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-1">
                <h3 className={`text-sm font-semibold truncate ${isActive ? 'text-app-primary' : 'text-app-text-main'}`}>
                  {user.name}
                </h3>
                <span className="text-xs text-app-text-sub font-medium">{lastMsg ? formatTime(lastMsg.timestamp) : ''}</span>
              </div>
              <p className="text-sm text-app-text-sub truncate font-normal">
                {previewText}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ChatList;