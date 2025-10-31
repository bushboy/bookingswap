import React from 'react';

interface AvatarProps {
    src?: string;
    alt?: string;
    size?: 'small' | 'medium' | 'large';
    fallback?: string;
    className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
    src,
    alt = 'Avatar',
    size = 'medium',
    fallback,
    className = ''
}) => {
    const sizeClasses = {
        small: 'w-8 h-8 text-sm',
        medium: 'w-10 h-10 text-base',
        large: 'w-12 h-12 text-lg'
    };

    const [imageError, setImageError] = React.useState(false);

    const handleImageError = () => {
        setImageError(true);
    };

    const showFallback = !src || imageError;

    return (
        <div
            className={`
        ${sizeClasses[size]} 
        rounded-full 
        flex items-center justify-center 
        bg-gray-200 
        text-gray-600 
        font-medium 
        overflow-hidden
        ${className}
      `}
        >
            {showFallback ? (
                <span>
                    {fallback || alt.charAt(0).toUpperCase()}
                </span>
            ) : (
                <img
                    src={src}
                    alt={alt}
                    onError={handleImageError}
                    className="w-full h-full object-cover"
                />
            )}
        </div>
    );
};

export default Avatar;