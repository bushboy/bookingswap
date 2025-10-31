import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    className?: string;
    variant?: 'default' | 'outline';
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    className = '',
    variant = 'default'
}) => {
    const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

    const variantClasses = {
        default: 'bg-gray-100 text-gray-800',
        outline: 'border border-gray-200 text-gray-700'
    };

    return (
        <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
            {children}
        </span>
    );
};