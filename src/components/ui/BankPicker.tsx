'use client'
import React, { useRef, useEffect, useState } from 'react'
import { fmt } from '@/lib/utils'
import { ACCOUNT_TYPE_COLORS } from '@/lib/theme'

interface Bank {
    id: string
    name: string
    account_type: string
    current_balance: number
}

interface BankPickerProps {
    banks: Bank[]
    selectedId: string | null
    onSelect: (id: string) => void
    excludeTypes?: string[]
}

export default function BankPicker({ banks, selectedId, onSelect, excludeTypes }: BankPickerProps) {
    const scrollRef = useRef<HTMLDivElement>(null)

    const filtered = excludeTypes
        ? banks.filter((b) => !excludeTypes.includes(b.account_type))
        : banks

    // Handle auto-scroll to selected on mount
    useEffect(() => {
        if (selectedId && scrollRef.current) {
            const activeEl = scrollRef.current.querySelector('.active') as HTMLElement
            if (activeEl) {
                scrollRef.current.scrollTo({
                    top: activeEl.offsetTop - (scrollRef.current.clientHeight / 2) + (activeEl.clientHeight / 2),
                    behavior: 'smooth'
                })
            }
        }
    }, [selectedId, banks])

    return (
        <div className="odometer-container">
            <style jsx>{`
        .odometer-container {
          position: relative;
          height: 140px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          overflow: hidden;
          box-shadow: inset 0 0 20px rgba(0,0,0,0.4);
        }

        .scroll-mask-top, .scroll-mask-bottom {
          position: absolute;
          left: 0;
          right: 0;
          height: 45px;
          z-index: 2;
          pointer-events: none;
        }

        .scroll-mask-top {
          top: 0;
          background: linear-gradient(to bottom, 1a1a2e 0%, rgba(26, 26, 46, 0) 100%);
        }

        .scroll-mask-bottom {
          bottom: 0;
          background: linear-gradient(to top, 1a1a2e 0%, rgba(26, 26, 46, 0) 100%);
        }

        .center-highlight {
          position: absolute;
          top: 50%;
          left: 8px;
          right: 8px;
          height: 40px;
          margin-top: -20px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          z-index: 1;
          pointer-events: none;
          box-shadow: 0 0 15px rgba(123, 116, 255, 0.05);
        }

        .odometer-scroll {
          height: 100%;
          overflow-y: scroll;
          scroll-snap-type: y mandatory;
          scrollbar-width: none; /* Firefox */
          padding: 50px 0; /* Vertical breathing room */
        }

        .odometer-scroll::-webkit-scrollbar {
          display: none; /* Chrome/Safari */
        }

        .bank-item {
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          scroll-snap-align: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          opacity: 0.3;
          transform: scale(0.85);
          user-select: none;
        }

        .bank-item.active {
          opacity: 1;
          transform: scale(1.05);
          z-index: 3;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          transition: all 0.3s;
        }

        .bank-item.active .dot {
          box-shadow: 0 0 12px currentColor;
        }

        .bank-name {
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
          transition: all 0.3s;
        }

        .bank-item.active .bank-name {
          color: #fff;
          font-weight: 700;
          font-size: 15px;
        }

        .bank-balance {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.3);
          font-family: monospace;
          transition: all 0.3s;
        }

        .bank-item.active .bank-balance {
          color: rgba(255, 255, 255, 0.6);
        }
      `}</style>

            {/* Aesthetic Masks & Highlights */}
            <div className="scroll-mask-top" />
            <div className="center-highlight" />
            <div className="scroll-mask-bottom" />

            {/* Main Scrollable Area */}
            <div className="odometer-scroll" ref={scrollRef}>
                {filtered.map((bank) => {
                    const color = ACCOUNT_TYPE_COLORS[bank.account_type] || '#7B74FF'
                    const active = selectedId === bank.id

                    return (
                        <div
                            key={bank.id}
                            className={`bank-item ${active ? 'active' : ''}`}
                            onClick={() => onSelect(bank.id)}
                        >
                            <div
                                className="dot"
                                style={{ background: color, color: color }}
                            />
                            <span className="bank-name">{bank.name}</span>
                            <span className="bank-balance">{fmt(bank.current_balance)}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
