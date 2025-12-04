import React from 'react';
import Avatar from './Avatar';
import { User } from '../types';
import { IconVoiceSolid, IconPhoneX } from './Icons';

interface VoiceCallOverlayProps {
  contact: User;
  onHangup: () => void;
  status: 'connecting' | 'connected' | 'error';
}

const VoiceCallOverlay: React.FC<VoiceCallOverlayProps> = ({ contact, onHangup, status }) => {
  return (
    <div className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-sm flex flex-col items-center justify-between py-20 animate-fade-in-up text-white">
      <div className="flex flex-col items-center space-y-6">
        <h2 className="text-2xl font-medium tracking-wide">{contact.name}</h2>
        
        <div className="relative">
            {/* Pulse Animation */}
            {status === 'connected' && (
                <>
                    <div className="absolute inset-0 bg-app-primary/30 rounded-full animate-ping opacity-75"></div>
                    <div className="absolute inset-0 bg-app-primary/20 rounded-full animate-pulse delay-75"></div>
                </>
            )}
            <Avatar src={contact.avatar} alt={contact.name} size="lg" shape="circle" />
        </div>

        <div className="text-gray-400 text-sm font-medium">
            {status === 'connecting' && 'Connecting...'}
            {status === 'connected' && 'Voice Connected'}
            {status === 'error' && 'Connection Failed'}
        </div>
      </div>

      <div className="flex flex-col items-center space-y-8 w-full">
         
         {/* Visualizer Placeholder */}
         <div className="h-16 flex items-center justify-center space-x-1">
            {status === 'connected' && Array.from({ length: 5 }).map((_, i) => (
                <div 
                    key={i} 
                    className="w-1.5 bg-white/80 rounded-full animate-pulse" 
                    style={{ 
                        height: `${Math.random() * 30 + 10}px`,
                        animationDuration: `${Math.random() * 0.5 + 0.5}s`
                    }}
                />
            ))}
         </div>

         <div className="flex items-center justify-center w-full px-12">
            <button 
                onClick={onHangup}
                className="flex flex-col items-center space-y-2 group"
            >
                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg group-hover:bg-red-600 transition-all active:scale-95">
                    <IconPhoneX />
                </div>
                <span className="text-sm font-medium text-gray-300">Hang Up</span>
            </button>
         </div>
      </div>
    </div>
  );
};

export default VoiceCallOverlay;