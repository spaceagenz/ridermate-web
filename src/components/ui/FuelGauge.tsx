'use client'
import React from 'react'

interface FuelGaugeProps {
    liters: number
    capacity: number
    efficiency: number
    pricePerLiter: number
}

export default function FuelGauge({ liters, capacity, efficiency, pricePerLiter }: FuelGaugeProps) {
    const pct = capacity > 0 ? Math.min(100, (liters / capacity) * 100) : 0
    const kmRange = Math.round(liters * efficiency)
    const color = pct > 50 ? '#1DB98A' : pct > 25 ? '#D4A843' : '#E05555'

    const ticks = [0, 25, 50, 75, 100]

    return (
        <div>
            {/* Gauge bar */}
            <div style={{
                position: 'relative',
                height: 28,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 14,
                overflow: 'hidden',
                marginBottom: 6,
            }}>
                <div style={{
                    position: 'absolute',
                    left: 0, top: 0, bottom: 0,
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}80, ${color})`,
                    borderRadius: 14,
                    transition: 'width 0.8s ease',
                }} />
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#fff',
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                }}>
                    {liters.toFixed(1)}L — {pct.toFixed(0)}%
                </div>
            </div>

            {/* Tick marks */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                {ticks.map((t) => (
                    <span key={t} style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                        {((t / 100) * capacity).toFixed(1)}L
                    </span>
                ))}
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                    { label: 'Range', value: `~${kmRange} km` },
                    { label: 'Efficiency', value: `${efficiency} km/L` },
                    { label: 'Price', value: `Rs.${pricePerLiter}/L` },
                ].map(({ label, value }) => (
                    <div key={label} style={{
                        flex: 1, minWidth: 80,
                        background: 'rgba(255,255,255,0.04)',
                        border: '0.5px solid rgba(255,255,255,0.07)',
                        borderRadius: 10, padding: '8px 10px',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#E8854A' }}>{value}</div>
                    </div>
                ))}
            </div>

            {liters < 2 && (
                <div style={{
                    marginTop: 10,
                    padding: '8px 12px',
                    background: 'rgba(224,85,85,0.15)',
                    border: '0.5px solid rgba(224,85,85,0.3)',
                    borderRadius: 10,
                    color: '#E05555',
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: 'center',
                }}>
                    ⚠️ Fuel critically low!
                </div>
            )}
        </div>
    )
}
