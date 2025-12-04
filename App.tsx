import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Message, ChatSession, Tab, Attachment } from './types';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import Avatar from './components/Avatar';
import MeTab from './components/MeTab';
import VoiceCallOverlay from './components/VoiceCallOverlay';
import { IconChat, IconContacts, IconDiscover, IconMe, IconPlus } from './components/Icons';
import { createChatStream } from './services/geminiService';
import { LiveService } from './services/liveService';

// --- MOCK DATA ---
const INITIAL_USER: User = {
  id: 'me',
  name: 'Me',
  avatar: 'https://picsum.photos/id/64/200/200',
};

const USERS: Record<string, User> = {
  'gemini': { id: 'gemini', name: 'Gemini AI', avatar: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg', isBot: true },
  'sarah': { id: 'sarah', name: 'Sarah Chen', avatar: 'https://picsum.photos/id/40/200/200' },
  'design': { id: 'design', name: 'Design Team', avatar: 'https://picsum.photos/id/180/200/200' },
};

const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: 's1',
    contactId: 'gemini',
    unreadCount: 0,
    lastMessageTimestamp: Date.now() - 100000,
    messages: [
      { id: 'm0', senderId: 'gemini', content: 'Hi! I can help you with text or analyze images you send.', timestamp: Date.now() - 100000, type: 'text' }
    ]
  },
  {
    id: 's2',
    contactId: 'sarah',
    unreadCount: 2,
    lastMessageTimestamp: Date.now() - 500000,
    messages: [
      { id: 'm1', senderId: 'sarah', content: 'Did you see the new designs?', timestamp: Date.now() - 500000, type: 'text' }
    ]
  },
  {
    id: 's3',
    contactId: 'design',
    unreadCount: 0,
    lastMessageTimestamp: Date.now() - 1000000,
    messages: [
      { id: 'm2', senderId: 'design', content: 'Meeting moved to 3pm', timestamp: Date.now() - 1000000, type: 'text' }
    ]
  }
];

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USER);
  const [sessions, setSessions] = useState<ChatSession[]>(INITIAL_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.CHATS);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Voice Call State
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [voiceErrorMsg, setVoiceErrorMsg] = useState<string>('');
  const liveServiceRef = useRef<LiveService | null>(null);

  // Responsive check
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSelectChat = (sessionId: string) => {
    setActiveSessionId(sessionId);
    // Mark as read
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, unreadCount: 0 } : s));
  };

  const handleUpdateUser = (updated: Partial<User>) => {
      setCurrentUser(prev => ({ ...prev, ...updated }));
  };

  // --- Voice Chat Logic ---
  const handleVoiceStart = async () => {
      if (!activeSessionId) return;
      const session = sessions.find(s => s.id === activeSessionId);
      if (!session) return;
      const contact = USERS[session.contactId];

      // Only allow voice chat with Gemini for now (due to API limit)
      if (!contact.isBot) {
          alert("Voice chat is currently only available with Gemini AI.");
          return;
      }

      setIsVoiceActive(true);
      setVoiceStatus('connecting');
      setVoiceErrorMsg('');

      const service = new LiveService();
      liveServiceRef.current = service;

      await service.connect(
          () => {
              // On Close
              setIsVoiceActive(false);
              setVoiceStatus('connecting');
          },
          (err) => {
              // On Error
              console.error("Voice connection error:", err);
              setVoiceStatus('error');
              setVoiceErrorMsg(err.message || "Unknown error");
              // Auto close after delay
              setTimeout(() => {
                  setIsVoiceActive(false);
              }, 3500);
          }
      );
      
      // If no error immediately, assume connected (optimistic)
      if (voiceStatus !== 'error') {
          setVoiceStatus('connected');
      }
  };

  const handleVoiceHangup = async () => {
      if (liveServiceRef.current) {
          await liveServiceRef.current.disconnect();
          liveServiceRef.current = null;
      }
      setIsVoiceActive(false);
  };

  const handleSendMessage = useCallback(async (text: string, attachment?: Attachment) => {
    if (!activeSessionId) return;

    const sessionIndex = sessions.findIndex(s => s.id === activeSessionId);
    if (sessionIndex === -1) return;

    const session = sessions[sessionIndex];
    const contact = USERS[session.contactId];

    const newUserMsg: Message = {
      id: Date.now().toString(),
      senderId: currentUser.id,
      content: text,
      attachment: attachment,
      timestamp: Date.now(),
      type: attachment ? attachment.type : 'text',
      status: 'sent'
    };

    // Update state with user message immediately
    setSessions(prev => {
        const newSessions = [...prev];
        const s = { ...newSessions[sessionIndex] };
        s.messages = [...s.messages, newUserMsg];
        s.lastMessageTimestamp = newUserMsg.timestamp;
        newSessions[sessionIndex] = s;
        newSessions.sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);
        return newSessions;
    });

    // If talking to bot
    if (contact.isBot) {
        const botMsgId = (Date.now() + 1).toString();
        const botPlaceholder: Message = {
            id: botMsgId,
            senderId: contact.id,
            content: "...",
            timestamp: Date.now() + 1,
            type: 'text',
            status: 'sending'
        };

        setSessions(prev => {
            const index = prev.findIndex(s => s.id === activeSessionId);
            if (index === -1) return prev;
            const newSessions = [...prev];
            newSessions[index].messages.push(botPlaceholder);
            return newSessions;
        });

        try {
            // Check if we need to send attachment data to Gemini
            // Only send if it is an image
            let geminiAttachment = undefined;
            if (attachment && attachment.type === 'image') {
                geminiAttachment = {
                    mimeType: attachment.mimeType || 'image/png',
                    data: attachment.url
                };
            }

            await createChatStream([], text, geminiAttachment, (chunkText) => {
                setSessions(prev => {
                    const index = prev.findIndex(s => s.id === activeSessionId);
                    if (index === -1) return prev;
                    const newSessions = [...prev];
                    const msgs = [...newSessions[index].messages];
                    const msgIndex = msgs.findIndex(m => m.id === botMsgId);
                    if (msgIndex !== -1) {
                        msgs[msgIndex] = { ...msgs[msgIndex], content: chunkText, status: 'sent' };
                    }
                    newSessions[index].messages = msgs;
                    newSessions[index].lastMessageTimestamp = Date.now();
                    return newSessions;
                });
            });
        } catch (e) {
             setSessions(prev => {
                const index = prev.findIndex(s => s.id === activeSessionId);
                if (index === -1) return prev;
                const newSessions = [...prev];
                const msgs = [...newSessions[index].messages];
                const msgIndex = msgs.findIndex(m => m.id === botMsgId);
                if (msgIndex !== -1) {
                    msgs[msgIndex] = { ...msgs[msgIndex], content: "Sorry, I encountered an error connecting.", status: 'error' };
                }
                newSessions[index].messages = msgs;
                return newSessions;
            });
        }
    } else {
        // Simple mock reply
        setTimeout(() => {
             const replyMsg: Message = {
                id: Date.now().toString(),
                senderId: contact.id,
                content: attachment ? `Nice ${attachment.type}!` : `Got it: ${text}`,
                timestamp: Date.now(),
                type: 'text'
            };
            setSessions(prev => {
                const index = prev.findIndex(s => s.id === activeSessionId);
                if (index === -1) return prev;
                const newSessions = [...prev];
                newSessions[index].messages.push(replyMsg);
                newSessions[index].lastMessageTimestamp = replyMsg.timestamp;
                newSessions.sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);
                return newSessions;
            });
        }, 1500);
    }

  }, [activeSessionId, sessions, currentUser.id]);

  // Layout Renders
  const renderMobile = () => {
    // 1. Voice Overlay
    if (isVoiceActive && activeSessionId) {
        const session = sessions.find(s => s.id === activeSessionId);
        if (session) {
            return (
                <VoiceCallOverlay 
                    contact={USERS[session.contactId]}
                    onHangup={handleVoiceHangup}
                    status={voiceStatus}
                    errorMessage={voiceErrorMsg}
                />
            );
        }
    }

    // 2. Chat Window
    if (activeSessionId) {
      const session = sessions.find(s => s.id === activeSessionId);
      if (!session) return null;
      return (
        <ChatWindow 
          session={session} 
          contact={USERS[session.contactId]}
          currentUser={currentUser}
          onSendMessage={handleSendMessage}
          onBack={() => setActiveSessionId(null)}
          onVoiceStart={handleVoiceStart}
          isMobile={true}
        />
      );
    }

    // 3. Main Tabs
    return (
      <div className="flex flex-col h-full bg-app-bg">
        <header className="bg-app-surface h-[60px] flex items-center justify-between px-5 sticky top-0 z-10 shadow-sm">
            <h1 className="font-bold text-xl text-app-primary">
                {activeTab === Tab.CHATS ? 'Messages' : 
                 activeTab === Tab.CONTACTS ? 'Contacts' :
                 activeTab === Tab.DISCOVER ? 'Discover' : 'Me'}
            </h1>
            {activeTab === Tab.CHATS && (
                <button className="p-2 bg-indigo-50 text-app-primary rounded-full hover:bg-indigo-100">
                    <IconPlus />
                </button>
            )}
        </header>

        <div className="flex-1 overflow-hidden flex flex-col relative">
          {activeTab === Tab.CHATS && (
            <ChatList 
              sessions={sessions} 
              users={USERS} 
              onSelectChat={handleSelectChat} 
              activeSessionId={null} 
            />
          )}
           {activeTab === Tab.ME && (
             <MeTab user={currentUser} onUpdateUser={handleUpdateUser} />
           )}
           {(activeTab === Tab.CONTACTS || activeTab === Tab.DISCOVER) && (
             <div className="flex-1 flex items-center justify-center text-gray-400">
                 Coming soon...
             </div>
           )}
        </div>

        <nav className="h-[70px] bg-app-surface border-t border-app-border flex items-center justify-around pb-2 px-2">
          <TabButton active={activeTab === Tab.CHATS} onClick={() => setActiveTab(Tab.CHATS)} icon={IconChat} label="Chats" />
          <TabButton active={activeTab === Tab.CONTACTS} onClick={() => setActiveTab(Tab.CONTACTS)} icon={IconContacts} label="Contacts" />
          <TabButton active={activeTab === Tab.DISCOVER} onClick={() => setActiveTab(Tab.DISCOVER)} icon={IconDiscover} label="Discover" />
          <TabButton active={activeTab === Tab.ME} onClick={() => setActiveTab(Tab.ME)} icon={IconMe} label="Me" />
        </nav>
      </div>
    );
  };

  const renderDesktop = () => {
    const activeSession = sessions.find(s => s.id === activeSessionId);
    
    return (
      <div className="flex h-full w-full max-w-[1400px] mx-auto bg-white shadow-2xl overflow-hidden my-0 md:my-6 md:rounded-2xl border border-app-border relative">
        
        {/* Voice Overlay (Desktop Absolute Position) */}
        {isVoiceActive && activeSession && (
            <VoiceCallOverlay 
                contact={USERS[activeSession.contactId]}
                onHangup={handleVoiceHangup}
                status={voiceStatus}
                errorMessage={voiceErrorMsg}
            />
        )}

        {/* Sidebar Nav */}
        <div className="w-[80px] bg-app-surface border-r border-app-border flex flex-col items-center py-6 space-y-8 z-20">
            <Avatar src={currentUser.avatar} alt="Me" size="md" shape="circle" />
            <div className="flex-1 flex flex-col space-y-8 w-full">
                 <button onClick={() => setActiveTab(Tab.CHATS)} className={`flex justify-center transition-colors ${activeTab === Tab.CHATS ? "text-app-primary" : "text-gray-400 hover:text-gray-600"}`}>
                    <IconChat active={activeTab === Tab.CHATS} />
                 </button>
                 <button onClick={() => setActiveTab(Tab.CONTACTS)} className={`flex justify-center transition-colors ${activeTab === Tab.CONTACTS ? "text-app-primary" : "text-gray-400 hover:text-gray-600"}`}>
                    <IconContacts active={activeTab === Tab.CONTACTS} />
                 </button>
                 <button onClick={() => setActiveTab(Tab.DISCOVER)} className={`flex justify-center transition-colors ${activeTab === Tab.DISCOVER ? "text-app-primary" : "text-gray-400 hover:text-gray-600"}`}>
                    <IconDiscover active={activeTab === Tab.DISCOVER} />
                 </button>
            </div>
            <button onClick={() => setActiveTab(Tab.ME)} className={`flex justify-center transition-colors ${activeTab === Tab.ME ? "text-app-primary" : "text-gray-400 hover:text-gray-600"} mb-2`}>
                 <IconMe active={activeTab === Tab.ME} />
            </button>
        </div>

        {/* List Column */}
        <div className="w-[360px] bg-app-surface border-r border-app-border flex flex-col z-10">
           <div className="h-[70px] flex items-center px-6 border-b border-app-border/50">
               <div className="bg-gray-100 rounded-xl flex items-center px-4 py-2.5 w-full text-sm text-gray-500 hover:bg-gray-200 transition-colors cursor-text">
                  <span className="mr-2">Search</span>
               </div>
           </div>
           
           {activeTab === Tab.CHATS ? (
             <ChatList 
                sessions={sessions} 
                users={USERS} 
                onSelectChat={handleSelectChat} 
                activeSessionId={activeSessionId} 
              />
           ) : activeTab === Tab.ME ? (
             <MeTab user={currentUser} onUpdateUser={handleUpdateUser} />
           ) : (
             <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                 Section under construction
             </div>
           )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 bg-gray-50/50 flex flex-col relative">
            {activeSession ? (
                <ChatWindow 
                    session={activeSession} 
                    contact={USERS[activeSession.contactId]}
                    currentUser={currentUser}
                    onSendMessage={handleSendMessage}
                    onBack={() => setActiveSessionId(null)}
                    onVoiceStart={handleVoiceStart}
                    isMobile={false}
                />
            ) : (
                <div className="flex-1 flex items-center justify-center text-gray-300 flex-col">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <IconChat active={false} />
                    </div>
                    <p className="text-lg font-medium text-gray-400">Select a chat to start messaging</p>
                </div>
            )}
        </div>
      </div>
    );
  };

  return isMobile ? renderMobile() : renderDesktop();
};

const TabButton = ({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
  <button onClick={onClick} className="flex flex-col items-center justify-center w-full h-full pt-1 transition-all">
    <div className={`p-1 rounded-xl ${active ? 'bg-indigo-50' : ''}`}>
        <Icon active={active} />
    </div>
    <span className={`text-[10px] mt-1 font-medium ${active ? 'text-app-primary' : 'text-gray-400'}`}>{label}</span>
  </button>
);

export default App;