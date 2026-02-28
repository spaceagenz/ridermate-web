'use client'
import React from 'react'
import { toISO } from '@/lib/utils'

interface MiniCalendarProps {
    selectedDate: string
    onSelect: (date: string) => void
    markedDates?: Set<string>
    allowFuture?: boolean
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function MiniCalendar({ selectedDate, onSelect, markedDates, allowFuture }: MiniCalendarProps) {
    const [viewDate, setViewDate] = React.useState(() => {
        const d = new Date(selectedDate + 'T00:00:00')
        return { year: d.getFullYear(), month: d.getMonth() }
    })

    const today = toISO(new Date())
    const { year, month } = viewDate

    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)

    const prevMonth = () => {
        if (month === 0) setViewDate({ year: year - 1, month: 11 })
        else setViewDate({ year, month: month - 1 })
    }
    const nextMonth = () => {
        if (month === 11) setViewDate({ year: year + 1, month: 0 })
        else setViewDate({ year, month: month + 1 })
    }

    return (
        <div style={{ userSelect: 'none' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#7B74FF', fontSize: 18, padding: '0 8px' }}>‹</button>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{MONTHS[month]} {year}</span>
                <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: '#7B74FF', fontSize: 18, padding: '0 8px' }}>›</button>
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
                {DAYS.map((d) => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: '2px 0' }}>{d}</div>
                ))}
            </div>

            {/* Cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                {cells.map((day, i) => {
                    if (!day) return <div key={i} />
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const isToday = dateStr === today
                    const isSelected = dateStr === selectedDate
                    const isFuture = dateStr > today
                    const isMarked = markedDates?.has(dateStr)
                    const disabled = isFuture && !allowFuture

                    return (
                        <button
                            key={i}
                            disabled={disabled}
                            onClick={() => !disabled && onSelect(dateStr)}
                            style={{
                                background: isSelected ? '#7B74FF' : isToday ? 'rgba(123,116,255,0.15)' : 'transparent',
                                border: isToday && !isSelected ? '1px solid #7B74FF' : '1px solid transparent',
                                borderRadius: 8,
                                color: disabled ? 'rgba(255,255,255,0.15)' : isSelected ? '#fff' : 'rgba(255,255,255,0.8)',
                                fontSize: 12,
                                fontWeight: isSelected || isToday ? 700 : 400,
                                padding: '5px 0',
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 1,
                            }}
                        >
                            {day}
                            {isMarked && (
                                <span style={{
                                    width: 4, height: 4, borderRadius: '50%',
                                    background: isSelected ? '#fff' : '#7B74FF',
                                }} />
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
