import React from 'react';

interface AvatarProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  shape?: 'square' | 'circle';
}

const Avatar: React.FC<AvatarProps> = ({ src, alt, size = 'md', shape = 'square' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const shapeClasses = {
    square: 'rounded-lg', 
    circle: 'rounded-full',
  };

  return (
    <img
      src={src}
      alt={alt}
      className={`${sizeClasses[size]} ${shapeClasses[shape]} object-cover bg-gray-200 border border-black/5 flex-shrink-0`}
    />
  );
};

export default Avatar;