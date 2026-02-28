'use client'
import React from 'react'

interface FieldProps {
    label: string
    value: string | number
    onChange: (val: string) => void
    type?: string
    placeholder?: string
    suffix?: string
    min?: number
    step?: number
}

export default function Field({ label, value, onChange, type = 'text', placeholder, suffix, min, step }: FieldProps) {
    return (
        <div className="field-group">
            <div className="field-label">{label}</div>
            <div style={{ position: 'relative' }}>
                <input
                    className="input-field"
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    min={min}
                    step={step}
                    style={{ paddingRight: suffix ? 44 : undefined }}
                />
                {suffix && (
                    <span style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        color: 'rgba(255,255,255,0.35)', fontSize: 12,
                    }}>{suffix}</span>
                )}
            </div>
        </div>
    )
}
