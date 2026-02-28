'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fmt, todayStr } from '@/lib/utils'
import { ACCOUNT_TYPE_COLORS, ACCOUNT_TYPE_LABELS } from '@/lib/theme'
import GlassCard from '@/components/ui/GlassCard'
import { Plus, ArrowRightLeft, Settings2, Trash2, Edit2, ChevronLeft } from 'lucide-react'

const ACCOUNT_TYPES = ['daily_use', 'savings', 'liability', 'emergency', 'wallet', 'cash']

export default function BankingPage() {
    const [tab, setTab] = useState<'Accounts' | 'Transfers' | 'Settings'>('Accounts')
    const router = useRouter()
    const [banks, setBanks] = useState<any[]>([])
    const [transfers, setTransfers] = useState<any[]>([])
    const today = todayStr()

    // Statement view
    const [viewBank, setViewBank] = useState<any | null>(null)
    const [statement, setStatement] = useState<any[]>([])

    // Add bank modal
    const [showAdd, setShowAdd] = useState(false)
    const [addForm, setAddForm] = useState({ name: '', account_type: 'daily_use', starting_balance: '' })
    const [addMsg, setAddMsg] = useState('')

    // Edit bank modal
    const [editBank, setEditBank] = useState<any | null>(null)
    const [editForm, setEditForm] = useState({ name: '', account_type: '', starting_balance: '' })

    // Transfer form
    const [fromId, setFromId] = useState<string | null>(null)
    const [toId, setToId] = useState<string | null>(null)
    const [transferAmt, setTransferAmt] = useState('')
    const [serviceCharge, setServiceCharge] = useState('0')
    const [transferNote, setTransferNote] = useState('')
    const [transferMsg, setTransferMsg] = useState('')

    const fetchBanks = useCallback(async () => {
        const [banksRes, latestIncRes] = await Promise.all([
            supabase.from('banks').select('*').eq('is_active', true).order('sort_order'),
            supabase.from('income_records').select('app, wallet_balance, date').eq('income_type', 'main').order('date', { ascending: false })
        ])

        if (banksRes.data) {
            let processedBanks = banksRes.data
            if (latestIncRes.data) {
                // Find latest chronological records for each app
                const latestUber = latestIncRes.data.find((r) => r.app === 'Uber')
                const latestPickMe = latestIncRes.data.find((r) => r.app === 'PickMe')

                processedBanks = processedBanks.map((b) => {
                    if (b.name === 'Uber Wallet' && latestUber) {
                        return { ...b, current_balance: latestUber.wallet_balance || 0 }
                    }
                    if (b.name === 'PickMe Wallet' && latestPickMe) {
                        return { ...b, current_balance: latestPickMe.wallet_balance || 0 }
                    }
                    return b
                })
            }
            setBanks(processedBanks)
        }
    }, [])

    const fetchTransfers = useCallback(async () => {
        const res = await supabase.from('bank_transfers').select('*').order('created_at', { ascending: false }).limit(50)
        if (res.data) setTransfers(res.data)
    }, [])

    useEffect(() => { fetchBanks() }, [fetchBanks])
    useEffect(() => { if (tab === 'Transfers') fetchTransfers() }, [tab, fetchTransfers])

    // Realtime
    useEffect(() => {
        const ch = supabase.channel('banking-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'banks' }, fetchBanks)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_transfers' }, fetchTransfers)
            .subscribe()
        return () => { supabase.removeChannel(ch) }
    }, [fetchBanks, fetchTransfers])

    // Realtime synchronization will handle DB updates accurately

    const fetchStatement = async (bank: any) => {
        setViewBank(bank)
        const [expenses, payments, txIn, txOut, incomes] = await Promise.all([
            supabase.from('daily_expenses').select('*').eq('bank_id', bank.id).order('date', { ascending: false }),
            supabase.from('liability_payments').select('*').eq('bank_id', bank.id).order('payment_date', { ascending: false }),
            supabase.from('bank_transfers').select('*').eq('to_bank_id', bank.id).order('transfer_date', { ascending: false }),
            supabase.from('bank_transfers').select('*').eq('from_bank_id', bank.id).order('transfer_date', { ascending: false }),
            supabase.from('income_records').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })
        ])

        const rows: any[] = []
            ; (expenses.data || []).forEach((e) => rows.push({ id: e.id, date: e.date, description: e.category + (e.note ? ` — ${e.note}` : ''), type: 'Expense', amount: -(e.amount || 0) }))
            ; (payments.data || []).forEach((p) => rows.push({ id: p.id, date: p.payment_date, description: 'Liability Payment' + (p.note ? ` — ${p.note}` : ''), type: 'Payment', amount: -(p.amount || 0) }))
            ; (txIn.data || []).forEach((t) => rows.push({ id: t.id, date: t.transfer_date, description: `Transfer In${t.note ? ` — ${t.note}` : ''}`, type: 'Transfer In', amount: t.amount || 0 }))
            ; (txOut.data || []).forEach((t) => rows.push({ id: t.id, date: t.transfer_date, description: `Transfer Out (fee: ${fmt(t.service_charge || 0)})${t.note ? ` — ${t.note}` : ''}`, type: 'Transfer Out', amount: -(((t.amount || 0) + (t.service_charge || 0))) }))

        if (bank.name === 'Cash on Hand') {
            const incList = incomes.data || [];
            for (const inc of incList) {
                const cVal = inc.cash_on_hand || 0;
                if (Math.abs(cVal) > 0.01) {
                    rows.push({ id: inc.id, date: inc.date, description: `Daily Earning`, type: 'Income', amount: cVal })
                }
            }
        }
        else if (bank.name.includes('Wallet')) {
            const appType = bank.name.split(' ')[0]; // Uber or PickMe
            const incList = incomes.data || [];

            // Sort ascending to calculate daily differences
            const sortedInc = [...incList].filter(i => i.app === appType).sort((a, b) => a.date.localeCompare(b.date));
            let prevW = bank.starting_balance || 0;
            for (const inc of sortedInc) {
                const wVal = inc.wallet_balance || 0;
                const change = wVal - prevW;
                if (Math.abs(change) > 0.01) {
                    rows.push({ id: inc.id, date: inc.date, description: `${appType} Settlement`, type: 'App Wallet', amount: change });
                }
                prevW = wVal;
            }
        }

        // Calculate running balance incrementally starting from chronological oldest
        rows.sort((a, b) => a.date.localeCompare(b.date));

        let runBal = bank.starting_balance || 0;
        for (const row of rows) {
            runBal += row.amount;
            row.running_balance = runBal;
        }

        // Sort descending explicitly for statement UI newest-first
        rows.sort((a, b) => b.date.localeCompare(a.date))
        setStatement(rows)
    }

    const addBank = async () => {
        if (!addForm.name) { alert('Enter bank name'); return }
        const bal = parseFloat(addForm.starting_balance) || 0
        await supabase.from('banks').insert({ name: addForm.name, account_type: addForm.account_type, starting_balance: bal, current_balance: bal, sort_order: banks.length + 1 })
        setAddForm({ name: '', account_type: 'daily_use', starting_balance: '' }); setShowAdd(false)
        setAddMsg('✅ Account added!'); setTimeout(() => setAddMsg(''), 2500)
        fetchBanks()
    }

    const saveEditBank = async () => {
        if (!editBank) return
        const updates: any = { name: editForm.name, account_type: editForm.account_type }

        const oldStartingBal = editBank.starting_balance || 0
        const newStartingBal = parseFloat(editForm.starting_balance) || 0
        const delta = newStartingBal - oldStartingBal

        updates.starting_balance = newStartingBal
        updates.current_balance = (editBank.current_balance || 0) + delta

        await supabase.from('banks').update(updates).eq('id', editBank.id)
        setEditBank(null); fetchBanks()
    }

    const removeBank = async (bank: any) => {
        if (bank.is_system) { alert('Cannot delete system accounts'); return }
        if (!confirm(`Remove ${bank.name}?`)) return
        await supabase.from('banks').update({ is_active: false }).eq('id', bank.id)
        fetchBanks()
    }

    const doTransfer = async () => {
        if (!fromId || !toId || fromId === toId || !transferAmt) { alert('Fill all transfer fields'); return }
        const amt = parseFloat(transferAmt)
        const charge = parseFloat(serviceCharge) || 0
        const fromBank = banks.find((b) => b.id === fromId)!
        const toBank = banks.find((b) => b.id === toId)!
        if (fromBank.current_balance < amt + charge) { alert('Insufficient balance'); return }
        await Promise.all([
            supabase.from('bank_transfers').insert({ from_bank_id: fromId, to_bank_id: toId, amount: amt, service_charge: charge, note: transferNote, transfer_date: today }),
            supabase.from('banks').update({ current_balance: fromBank.current_balance - amt - charge }).eq('id', fromId),
            supabase.from('banks').update({ current_balance: toBank.current_balance + amt }).eq('id', toId),
        ])
        setTransferAmt(''); setServiceCharge('0'); setTransferNote('')
        setTransferMsg('✅ Transfer done!'); setTimeout(() => setTransferMsg(''), 2500)
        fetchBanks(); fetchTransfers()
    }

    const assets = banks.filter((b) => b.account_type !== 'liability').reduce((s, b) => s + (b.current_balance || 0), 0)
    const liabSum = banks.filter((b) => b.account_type === 'liability').reduce((s, b) => s + Math.abs(b.current_balance || 0), 0)
    const netWorth = assets - liabSum

    return (
        <div className="fade-in">
            {/* Statement view */}
            {viewBank && (
                <div>
                    <button className="btn btn-ghost" style={{ marginBottom: 12 }} onClick={() => setViewBank(null)}>
                        <ChevronLeft size={14} /> Back
                    </button>
                    <GlassCard accentColor={ACCOUNT_TYPE_COLORS[viewBank.account_type]} style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 18 }}>{viewBank.name}</div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                            Starting: {fmt(viewBank.starting_balance || 0)}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 22, marginTop: 8, color: viewBank.current_balance < 0 ? '#E05555' : '#1DB98A' }}>
                            {fmt(viewBank.current_balance || 0)}
                        </div>
                    </GlassCard>
                    <GlassCard>
                        <div style={{ fontWeight: 700, marginBottom: 12 }}>Transaction History</div>
                        {statement.length === 0 && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 24 }}>No transactions</div>}
                        {statement.map((row, i) => {
                            const handleClick = () => {
                                if (row.type === 'Expense') router.push(`/expenses?date=${row.date}&edit_id=${row.id}`)
                                else if (row.type === 'Payment') router.push(`/liabilities?date=${row.date}&edit_id=${row.id}`)
                                else if (row.type === 'Income' || row.type === 'App Wallet') router.push(`/income?date=${row.date}&edit_id=${row.id}`)
                                else if (row.type.includes('Transfer')) { setTab('Transfers'); setViewBank(null); }
                            }
                            return (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                                    <div>
                                        <div style={{ fontWeight: 500, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {row.description}
                                            <button title="Edit Original Entry" onClick={handleClick} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6, color: '#4A9FD4', cursor: 'pointer', padding: 4, display: 'inline-flex' }}>
                                                <Edit2 size={11} />
                                            </button>
                                        </div>
                                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                                            <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>{row.type}</span>
                                            {' '}{row.date}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, marginLeft: 8 }}>
                                        <div style={{ fontWeight: 700, color: row.amount >= 0 ? '#1DB98A' : '#E05555', fontSize: 14 }}>
                                            {row.amount >= 0 ? '+' : ''}{fmt(row.amount)}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, fontWeight: 500 }}>
                                            Bal: {fmt(row.running_balance)}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </GlassCard>
                </div>
            )}

            {!viewBank && (
                <>
                    <div className="tab-bar" style={{ marginBottom: 14 }}>
                        {(['Accounts', 'Transfers', 'Settings'] as const).map((t) => (
                            <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
                        ))}
                    </div>

                    {/* ACCOUNTS */}
                    {tab === 'Accounts' && (
                        <div>
                            {/* Header stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                                {[
                                    { label: 'Total Assets', value: fmt(assets), color: '#1DB98A' },
                                    { label: 'Net Worth', value: fmt(netWorth), color: netWorth >= 0 ? '#4A9FD4' : '#E05555' },
                                    { label: 'Liabilities', value: fmt(liabSum), color: '#E05577' },
                                ].map((s) => (
                                    <GlassCard key={s.label} style={{ textAlign: 'center', padding: 12 }}>
                                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                                        <div style={{ fontWeight: 800, fontSize: 13, color: s.color }}>{s.value}</div>
                                    </GlassCard>
                                ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                                <button className="btn btn-primary" style={{ fontSize: 12, padding: '8px 14px' }} onClick={() => setShowAdd(true)}>
                                    <Plus size={13} /> Add Account
                                </button>
                            </div>

                            {banks.map((bank) => {
                                const color = ACCOUNT_TYPE_COLORS[bank.account_type] || '#7B74FF'
                                return (
                                    <GlassCard key={bank.id} accentColor={color} style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => fetchStatement(bank)}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                                                    <span className="badge" style={{ background: `${color}20`, color }}>{ACCOUNT_TYPE_LABELS[bank.account_type] || bank.account_type}</span>
                                                    {bank.is_system && <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>System</span>}
                                                </div>
                                                <div style={{ fontWeight: 700, fontSize: 16 }}>{bank.name}</div>
                                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Tap to view statement</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 800, fontSize: 20, color: bank.current_balance < 0 ? '#E05555' : color }}>
                                                    {fmt(bank.current_balance || 0)}
                                                </div>
                                            </div>
                                        </div>
                                    </GlassCard>
                                )
                            })}
                            {addMsg && <div style={{ textAlign: 'center', marginTop: 8, color: '#1DB98A', fontWeight: 600 }}>{addMsg}</div>}
                        </div>
                    )}

                    {/* TRANSFERS */}
                    {tab === 'Transfers' && (
                        <div>
                            <GlassCard style={{ marginBottom: 12 }}>
                                <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <ArrowRightLeft size={15} color="#4A9FD4" /> New Transfer
                                </div>
                                <div className="field-group">
                                    <div className="field-label">From</div>
                                    <div className="chip-scroll">
                                        {banks.map((b) => (
                                            <button key={b.id} className={`chip${fromId === b.id ? ' active' : ''}`} onClick={() => setFromId(fromId === b.id ? null : b.id)}>
                                                {b.name} ({fmt(b.current_balance)})
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="field-group">
                                    <div className="field-label">To</div>
                                    <div className="chip-scroll">
                                        {banks.filter((b) => b.id !== fromId).map((b) => (
                                            <button key={b.id} className={`chip${toId === b.id ? ' active' : ''}`} onClick={() => setToId(toId === b.id ? null : b.id)}>
                                                {b.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className="field-group">
                                        <div className="field-label">Amount (Rs.)</div>
                                        <input type="number" className="input-field" value={transferAmt} onChange={(e) => setTransferAmt(e.target.value)} placeholder="0" />
                                    </div>
                                    <div className="field-group">
                                        <div className="field-label">Service Charge</div>
                                        <input type="number" className="input-field" value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value)} placeholder="0" />
                                    </div>
                                </div>
                                <div className="field-group">
                                    <div className="field-label">Note (optional)</div>
                                    <input type="text" className="input-field" value={transferNote} onChange={(e) => setTransferNote(e.target.value)} placeholder="Note" />
                                </div>
                                <button className="btn btn-primary" style={{ width: '100%' }} onClick={doTransfer}>
                                    <ArrowRightLeft size={14} /> Transfer
                                </button>
                                {transferMsg && <div style={{ textAlign: 'center', marginTop: 8, color: '#1DB98A', fontWeight: 600 }}>{transferMsg}</div>}
                            </GlassCard>

                            {transfers.length > 0 && (
                                <GlassCard>
                                    <div style={{ fontWeight: 700, marginBottom: 12 }}>Transfer History</div>
                                    {transfers.map((t) => {
                                        const fromB = banks.find((b) => b.id === t.from_bank_id)
                                        const toB = banks.find((b) => b.id === t.to_bank_id)
                                        return (
                                            <div key={t.id} style={{ padding: '10px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                                                            {fromB?.name || '?'} → {toB?.name || '?'}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                                                            {t.transfer_date}{t.note ? ` · ${t.note}` : ''}{(t.service_charge || 0) > 0 ? ` · Fee: ${fmt(t.service_charge)}` : ''}
                                                        </div>
                                                    </div>
                                                    <div style={{ fontWeight: 700, color: '#4A9FD4' }}>{fmt(t.amount)}</div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </GlassCard>
                            )}
                        </div>
                    )}

                    {/* SETTINGS */}
                    {tab === 'Settings' && (
                        <div>
                            <GlassCard>
                                <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Settings2 size={15} color="#7B74FF" /> Manage Accounts
                                </div>
                                {banks.map((bank) => {
                                    const color = ACCOUNT_TYPE_COLORS[bank.account_type] || '#7B74FF'
                                    return (
                                        <div key={bank.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{bank.name}</div>
                                                <div style={{ fontSize: 11, color }}>
                                                    {ACCOUNT_TYPE_LABELS[bank.account_type] || bank.account_type}
                                                    {bank.is_system ? ' · System' : ''}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn btn-ghost" style={{ padding: '5px 8px', fontSize: 11 }}
                                                    onClick={() => { setEditBank(bank); setEditForm({ name: bank.name, account_type: bank.account_type, starting_balance: String(bank.starting_balance || '') }) }}>
                                                    <Edit2 size={12} />
                                                </button>
                                                {!bank.is_system && (
                                                    <button className="btn btn-red" style={{ padding: '5px 8px', fontSize: 11 }} onClick={() => removeBank(bank)}>
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </GlassCard>
                        </div>
                    )}
                </>
            )}

            {/* Add Bank Modal */}
            {showAdd && (
                <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-handle" />
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Add Account</div>
                        <div className="field-group">
                            <div className="field-label">Account Name</div>
                            <input type="text" className="input-field" value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. ComBank" />
                        </div>
                        <div className="field-group">
                            <div className="field-label">Account Type</div>
                            <select className="input-field" value={addForm.account_type} onChange={(e) => setAddForm((p) => ({ ...p, account_type: e.target.value }))} style={{ appearance: 'none' }}>
                                {ACCOUNT_TYPES.map((t) => (
                                    <option key={t} value={t} style={{ background: '#1a1a2e', color: '#fff' }}>
                                        {ACCOUNT_TYPE_LABELS[t] || t}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="field-group">
                            <div className="field-label">Starting Balance (Rs.)</div>
                            <input type="number" className="input-field" value={addForm.starting_balance} onChange={(e) => setAddForm((p) => ({ ...p, starting_balance: e.target.value }))} placeholder="0" />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={addBank}>Add Account</button>
                            <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Bank Modal */}
            {editBank && (
                <div className="modal-overlay" onClick={() => setEditBank(null)}>
                    <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-handle" />
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Edit Account</div>
                        <div className="field-group">
                            <div className="field-label">Account Name</div>
                            <input type="text" className="input-field" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
                        </div>
                        <div className="field-group">
                            <div className="field-label">Account Type</div>
                            <select className="input-field" value={editForm.account_type} onChange={(e) => setEditForm((p) => ({ ...p, account_type: e.target.value }))} style={{ appearance: 'none' }}>
                                {ACCOUNT_TYPES.map((t) => (
                                    <option key={t} value={t} style={{ background: '#1a1a2e', color: '#fff' }}>
                                        {ACCOUNT_TYPE_LABELS[t] || t}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="field-group">
                            <div className="field-label">Starting Balance (Opening Balance)</div>
                            <input type="number" className="input-field" value={editForm.starting_balance} onChange={(e) => setEditForm((p) => ({ ...p, starting_balance: e.target.value }))} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveEditBank}>Save</button>
                            <button className="btn btn-ghost" onClick={() => setEditBank(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
