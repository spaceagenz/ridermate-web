'use client'
import React from 'react'

interface GlassCardProps {
    children: React.ReactNode
    accentColor?: string
    style?: React.CSSProperties
    className?: string
    onClick?: () => void
}

export default function GlassCard({ children, accentColor, style, className, onClick }: GlassCardProps) {
    return (
        <div
            onClick={onClick}
            style={{
                background: accentColor ? `${accentColor}0D` : 'rgba(255,255,255,0.04)',
                border: `0.5px solid ${accentColor ? accentColor + '40' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 16,
                padding: 16,
                backdropFilter: 'blur(12px)',
                cursor: onClick ? 'pointer' : undefined,
                ...style,
            }}
            className={className}
        >
            {children}
        </div>
    )
}
