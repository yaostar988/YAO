import React, { useState, useRef, useEffect } from 'react';
import { Message, User, Attachment } from '../types';
import Avatar from './Avatar';
import { IconBack, IconEllipsis, IconPlus, IconVoice, IconImage, IconFile } from './Icons';

interface ChatWindowProps {
  session: { id: string; contactId: string; messages: Message[] };
  contact: User;
  currentUser: User;
  onSendMessage: (text: string, attachment?: Attachment) => void;
  onBack: () => void;
  onVoiceStart: () => void;
  isMobile: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ session, contact, currentUser, onSendMessage, onBack, onVoiceStart, isMobile }) => {
  const [inputValue, setInputValue] = useState('');
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [session.messages]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '40px';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const base64 = reader.result as string;
        const attachment: Attachment = {
            type,
            url: base64,
            name: file.name,
            mimeType: file.type,
            size: file.size
        };
        // For images, we can optionally ask for text, but here we just send immediately
        onSendMessage("", attachment);
        setShowPlusMenu(false);
    };
    reader.readAsDataURL(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-app-bg relative">
      {/* Header */}
      <header className="h-[64px] px-4 flex items-center justify-between bg-app-surface/90 backdrop-blur-md border-b border-app-border sticky top-0 z-10 shadow-sm">
        <div className="flex items-center">
           {isMobile && (
             <button onClick={onBack} className="mr-3 -ml-2 p-2 hover:bg-gray-100 rounded-full text-app-text-main">
               <IconBack />
             </button>
           )}
           <div>
             <h2 className="text-lg font-bold text-app-text-main">{contact.name}</h2>
             {contact.isBot && <span className="text-xs text-app-primary font-medium">AI Assistant</span>}
           </div>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-full text-app-text-main">
           <IconEllipsis />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
        {session.messages.map((msg, index) => {
            const isMe = msg.senderId === currentUser.id;
            const showTimestamp = index === 0 || (msg.timestamp - session.messages[index-1].timestamp > 5 * 60 * 1000);

            return (
                <div key={msg.id} className="flex flex-col">
                    {showTimestamp && (
                        <div className="flex justify-center mb-6">
                            <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    )}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                        {!isMe && (
                             <Avatar src={contact.avatar} alt={contact.name} size="sm" shape="circle" />
                        )}
                        
                        <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            {/* Attachment Rendering */}
                            {msg.attachment && (
                                <div className={`mb-1 overflow-hidden rounded-2xl border border-gray-100 shadow-sm ${
                                  msg.attachment.type === 'image' ? 'bg-transparent border-0' : 'bg-white p-3'
                                }`}>
                                   {msg.attachment.type === 'image' ? (
                                     <img src={msg.attachment.url} alt="Attachment" className="max-w-full rounded-2xl max-h-[300px] object-cover" />
                                   ) : (
                                     <div className="flex items-center gap-3 min-w-[200px]">
                                        <div className="p-2 bg-indigo-50 rounded-lg text-app-primary">
                                            <IconFile />
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-sm font-medium truncate text-gray-900">{msg.attachment.name}</span>
                                            <span className="text-xs text-gray-500">{(msg.attachment.size || 0) / 1000} KB</span>
                                        </div>
                                     </div>
                                   )}
                                </div>
                            )}

                            {/* Text Content */}
                            {msg.content && (
                                <div className={`px-4 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm break-words ${
                                    isMe 
                                    ? 'bg-app-bubble-sent text-white rounded-br-none' 
                                    : 'bg-app-bubble-rec text-app-text-main rounded-bl-none border border-gray-100'
                                }`}>
                                    {msg.content}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-app-surface border-t border-app-border p-3">
        <div className="flex items-end gap-2 relative">
             {/* Hidden Inputs */}
            <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'image')} />
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileSelect(e, 'file')} />

            {/* Plus Menu Popup */}
            {showPlusMenu && (
                <div className="absolute bottom-16 left-0 bg-white rounded-xl shadow-xl border border-gray-100 p-2 flex flex-col gap-1 z-20 w-40 animate-fade-in-up">
                    <button 
                        onClick={() => imageInputRef.current?.click()}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 text-left"
                    >
                        <div className="text-app-primary"><IconImage /></div>
                        Photos
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 text-left"
                    >
                        <div className="text-app-primary"><IconFile /></div>
                        Files
                    </button>
                </div>
            )}

            <button 
                onClick={() => setShowPlusMenu(!showPlusMenu)}
                className={`p-2.5 rounded-full transition-colors mb-1 ${showPlusMenu ? 'bg-gray-100 text-app-primary' : 'text-gray-400 hover:bg-gray-100'}`}
            >
                <IconPlus />
            </button>

            <div className="flex-1 bg-gray-100 rounded-[20px] flex items-center px-4 py-1 mb-1 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="w-full bg-transparent border-none outline-none resize-none text-[15px] max-h-[120px] py-2.5 text-gray-800 placeholder-gray-400"
                    rows={1}
                    style={{ height: '40px' }}
                />
            </div>
            
            {inputValue.trim() ? (
                <button 
                    onClick={handleSend}
                    className="h-[40px] px-5 bg-app-primary hover:bg-app-primary-hover text-white rounded-full text-sm font-semibold shadow-md transition-all active:scale-95 mb-1"
                >
                    Send
                </button>
            ) : (
                <button 
                    onClick={onVoiceStart}
                    className="p-2.5 text-gray-400 hover:bg-gray-100 hover:text-app-primary rounded-full mb-1"
                >
                    <IconVoice />
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;