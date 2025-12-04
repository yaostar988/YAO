import React, { useRef, useState } from 'react';
import { User } from '../types';
import Avatar from './Avatar';
import { IconEdit, IconImage } from './Icons';

interface MeTabProps {
  user: User;
  onUpdateUser: (updatedUser: Partial<User>) => void;
}

const MeTab: React.FC<MeTabProps> = ({ user, onUpdateUser }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(user.name);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    if (nameInput.trim()) {
        onUpdateUser({ name: nameInput });
        setIsEditing(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            onUpdateUser({ avatar: reader.result as string });
        };
        reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex-1 bg-app-bg flex flex-col">
      <div className="bg-app-surface p-8 pb-12 shadow-sm mb-4 flex flex-col items-center relative">
        <div className="relative group">
            <Avatar src={user.avatar} alt={user.name} size="lg" shape="circle" />
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
            >
                <IconImage />
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleAvatarChange}
            />
        </div>

        <div className="mt-4 flex flex-col items-center">
             {isEditing ? (
                 <div className="flex items-center gap-2">
                     <input 
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="bg-gray-100 px-3 py-1.5 rounded-lg border-none outline-none text-center font-bold text-xl text-app-text-main w-40 focus:ring-2 focus:ring-app-primary"
                        autoFocus
                     />
                     <button onClick={handleSave} className="text-sm text-app-primary font-bold">Save</button>
                 </div>
             ) : (
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-app-text-main">{user.name}</h2>
                    <button onClick={() => setIsEditing(true)} className="text-gray-400 hover:text-app-primary">
                        <IconEdit />
                    </button>
                </div>
             )}
             <p className="text-sm text-gray-400 mt-1">ID: {user.id}</p>
        </div>
      </div>

      <div className="bg-app-surface shadow-sm">
          <MenuItem title="Services" />
          <MenuItem title="Favorites" />
          <MenuItem title="Sticker Gallery" />
          <MenuItem title="Settings" last />
      </div>
    </div>
  );
};

const MenuItem = ({ title, last = false }: { title: string, last?: boolean }) => (
    <div className={`p-4 flex items-center justify-between active:bg-gray-50 cursor-pointer ${!last ? 'border-b border-gray-100' : ''}`}>
        <span className="text-[15px] font-medium text-app-text-main">{title}</span>
        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
    </div>
);

export default MeTab;