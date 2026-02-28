'use client'
import React from 'react'

interface ReportRowProps {
    label: string
    value: string | number
    color?: string
    bold?: boolean
    divider?: boolean
}

export default function ReportRow({ label, value, color, bold, divider }: ReportRowProps) {
    if (divider) return <div className="divider" />
    return (
        <div className="report-row">
            <span className="report-label">{label}</span>
            <span
                className="report-value"
                style={{ color: color || 'rgba(255,255,255,0.9)', fontWeight: bold ? 700 : 600 }}
            >
                {value}
            </span>
        </div>
    )
}
