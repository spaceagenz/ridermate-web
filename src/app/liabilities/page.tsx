'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt, todayStr } from '@/lib/utils'
import { computeLiabilityStatus, calcTotalInterest, calcMonthsRemaining } from '@/lib/calculations'
import GlassCard from '@/components/ui/GlassCard'
import BankPicker from '@/components/ui/BankPicker'
import { Plus, Trash2, Edit2, DollarSign, TrendingDown } from 'lucide-react'

const LIABILITY_TYPES = [
    { key: 'pawning', label: 'Ring (Pawning)', color: '#E05577', defaultMethod: 'interest_only' },
    { key: 'finance', label: 'Bike (Finance)', color: '#E8854A', defaultMethod: 'reducing_balance' },
    { key: 'loan', label: 'Loan', color: '#D4A843', defaultMethod: 'flat' },
    { key: 'credit_card', label: 'Mobile Phone', color: '#7B74FF', defaultMethod: 'flat' },
    { key: 'other', label: 'Other', color: '#4A9FD4', defaultMethod: 'none' },
]

const INTEREST_METHODS = [
    { key: 'flat', label: 'Flat Rate', desc: 'Fixed interest over term' },
    { key: 'reducing_balance', label: 'Reducing Balance', desc: 'EMI-based, interest reduces' },
    { key: 'interest_only', label: 'Interest Only', desc: 'Pay interest monthly, principal intact' },
    { key: 'none', label: 'None', desc: 'No interest applied' },
]

const PRIORITY_LEVELS = ['high', 'medium', 'low']
const PRIORITY_COLORS: Record<string, string> = { high: '#E05555', medium: '#E8854A', low: '#1DB98A' }

export default function LiabilitiesPage() {
    const [tab, setTab] = useState<'Active' | 'History' | 'Net Worth'>('Active')
    const [liabilities, setLiabilities] = useState<any[]>([])
    const [payments, setPayments] = useState<any[]>([])
    const [banks, setBanks] = useState<any[]>([])

    // Modal
    const [showAddModal, setShowAddModal] = useState(false)
    const [modalStep, setModalStep] = useState(1)
    const [editLiab, setEditLiab] = useState<any | null>(null)
    const [form, setForm] = useState({
        name: '', liability_type: 'loan', interest_method: 'flat',
        principal_amount: '', interest_rate: '', monthly_payment: '',
        arrears_amount: '0', payment_day: '', start_date: '', end_date: '',
        note: '', priority_level: 'medium', priority_percent: '',
    })

    // Payment modal
    const [payLiab, setPayLiab] = useState<any | null>(null)
    const [payForm, setPayForm] = useState({ amount: '', payment_date: todayStr(), note: '', bank_id: '' })
    const [payMsg, setPayMsg] = useState('')
    const [editPayId, setEditPayId] = useState<string | null>(null)

    const [msg, setMsg] = useState('')

    const fetchData = useCallback(async () => {
        const [liabRes, payRes, bankRes, latestIncRes] = await Promise.all([
            supabase.from('liabilities').select('*').order('created_at'),
            supabase.from('liability_payments').select('*').order('payment_date', { ascending: false }),
            supabase.from('banks').select('id,name,account_type,current_balance').eq('is_active', true).order('sort_order'),
            supabase.from('income_records').select('app, wallet_balance, date').eq('income_type', 'main').order('date', { ascending: false })
        ])
        if (liabRes.data) setLiabilities(liabRes.data)
        if (payRes.data) setPayments(payRes.data)
        if (bankRes.data) {
            let processedBanks = bankRes.data;
            if (latestIncRes.data) {
                const latestUber = latestIncRes.data.find((r) => r.app === 'Uber')
                const latestPickMe = latestIncRes.data.find((r) => r.app === 'PickMe')
                processedBanks = processedBanks.map((b) => {
                    if (b.name === 'Uber Wallet' && latestUber) return { ...b, current_balance: latestUber.wallet_balance || 0 }
                    if (b.name === 'PickMe Wallet' && latestPickMe) return { ...b, current_balance: latestPickMe.wallet_balance || 0 }
                    return b
                })
            }
            setBanks(processedBanks)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const d = params.get('date');
            const editId = params.get('edit_id');
            if (d && editId) {
                supabase.from('liability_payments').select('*').eq('id', editId).single().then(({ data }) => {
                    if (data) {
                        supabase.from('liabilities').select('*').eq('id', data.liability_id).single().then((liabRes) => {
                            if (liabRes.data) {
                                setPayLiab(liabRes.data);
                                setPayForm({
                                    amount: String(data.amount || ''),
                                    payment_date: data.payment_date || d,
                                    note: data.note || '',
                                    bank_id: data.bank_id || ''
                                });
                                setEditPayId(editId);
                                setTab('History');
                            }
                        })
                    }
                })
            }
        }
    }, [])

    const resetForm = () => setForm({
        name: '', liability_type: 'loan', interest_method: 'flat',
        principal_amount: '', interest_rate: '', monthly_payment: '',
        arrears_amount: '0', payment_day: '', start_date: '', end_date: '',
        note: '', priority_level: 'medium', priority_percent: '',
    })

    const openAdd = () => { resetForm(); setEditLiab(null); setShowAddModal(true); setModalStep(1) }
    const openEdit = (l: any) => {
        setEditLiab(l)
        setForm({
            name: l.name, liability_type: l.liability_type, interest_method: l.interest_method,
            principal_amount: String(l.principal_amount || ''), interest_rate: String(l.interest_rate || ''),
            monthly_payment: String(l.monthly_payment || ''), arrears_amount: String(l.arrears_amount || '0'),
            payment_day: String(l.payment_day || ''), start_date: l.start_date || '', end_date: l.end_date || '',
            note: l.note || '', priority_level: l.priority_level || 'medium', priority_percent: String(l.priority_percent || ''),
        })
        setShowAddModal(true); setModalStep(1)
    }

    const saveLiability = async () => {
        const row = {
            name: form.name,
            liability_type: form.liability_type,
            interest_method: form.interest_method,
            principal_amount: parseFloat(form.principal_amount) || 0,
            interest_rate: parseFloat(form.interest_rate) || 0,
            monthly_payment: parseFloat(form.monthly_payment) || 0,
            arrears_amount: parseFloat(form.arrears_amount) || 0,
            payment_day: parseInt(form.payment_day) || null,
            start_date: form.start_date || null,
            end_date: form.end_date || null,
            note: form.note || null,
            priority_level: form.priority_level,
            priority_percent: parseFloat(form.priority_percent) || 0,
            is_active: true,
        }
        if (editLiab) {
            await supabase.from('liabilities').update(row).eq('id', editLiab.id)
        } else {
            await supabase.from('liabilities').insert(row)
        }
        setShowAddModal(false); setMsg('✅ Saved!'); setTimeout(() => setMsg(''), 2500)
        fetchData()
    }

    const deleteLiability = async (id: string) => {
        if (!confirm('Delete liability?')) return
        await supabase.from('liabilities').update({ is_active: false }).eq('id', id)
        fetchData()
    }

    const openPayment = (l: any) => {
        const status = computeLiabilityStatus(l, payments)
        setPayLiab(l)
        setPayForm({ amount: String(status.displayMonthly?.toFixed(0) || l.monthly_payment || ''), payment_date: todayStr(), note: '', bank_id: '' })
        setEditPayId(null)
    }

    const savePayment = async () => {
        if (!payForm.amount || !payForm.bank_id) { alert('Fill amount and select bank'); return }
        const amt = parseFloat(payForm.amount)
        const isFuture = payForm.payment_date > todayStr()
        const bank = banks.find((b) => b.id === payForm.bank_id)
        if (!isFuture && bank && bank.current_balance < amt) { alert('Insufficient balance'); return }

        if (editPayId) {
            const old = payments.find((p) => p.id === editPayId)
            await supabase.from('liability_payments').update({ amount: amt, payment_date: payForm.payment_date, note: payForm.note, bank_id: payForm.bank_id }).eq('id', editPayId)
            if (bank && old) {
                let newBal = bank.current_balance
                if (old.payment_date <= todayStr() && !old.is_future) newBal += (old.amount || 0)
                if (!isFuture) newBal -= amt
                await supabase.from('banks').update({ current_balance: newBal }).eq('id', payForm.bank_id)
            }
        } else {
            await supabase.from('liability_payments').insert({ liability_id: payLiab.id, amount: amt, payment_date: payForm.payment_date, note: payForm.note, bank_id: payForm.bank_id, is_future: isFuture })
            if (!isFuture && bank) {
                await supabase.from('banks').update({ current_balance: bank.current_balance - amt }).eq('id', payForm.bank_id)
            }
        }
        setPayLiab(null); setEditPayId(null)
        setPayMsg('✅ Payment recorded!'); setTimeout(() => setPayMsg(''), 2500)

        if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);

        fetchData()
    }

    const deletePayment = async (p: any) => {
        if (!confirm('Delete payment?')) return
        await supabase.from('liability_payments').delete().eq('id', p.id)
        if (!p.is_future && p.bank_id) {
            const bank = banks.find((b) => b.id === p.bank_id)
            if (bank) await supabase.from('banks').update({ current_balance: bank.current_balance + (p.amount || 0) }).eq('id', p.bank_id)
        }
        // Auto-reactivate liability if its balance becomes > 0
        const liab = liabilities.find(l => l.id === p.liability_id)
        if (liab && !liab.is_active) {
            const remainingPayments = payments.filter(pay => pay.id !== p.id)
            const stat = computeLiabilityStatus(liab, remainingPayments)
            if (stat.remaining > 0) {
                await supabase.from('liabilities').update({ is_active: true }).eq('id', liab.id)
            }
        }

        fetchData()
    }

    const visibleLiabilities = liabilities.filter(l => l.is_active)
    const activeLiabilities = visibleLiabilities.filter(l => computeLiabilityStatus(l, payments).remaining > 0)
    const completedLiabilities = visibleLiabilities.filter(l => computeLiabilityStatus(l, payments).remaining <= 0)

    // Net worth
    const totalAssets = banks.filter((b) => b.account_type !== 'liability').reduce((s, b) => s + (b.current_balance || 0), 0)
    const totalLiabRemaining = activeLiabilities.reduce((s, l) => {
        const status = computeLiabilityStatus(l, payments)
        return s + (status.remaining || 0)
    }, 0)
    const netWorth = totalAssets - totalLiabRemaining

    const typeInfo = (key: string) => LIABILITY_TYPES.find((t) => t.key === key) || LIABILITY_TYPES[2]

    return (
        <div className="fade-in">
            <div className="tab-bar" style={{ marginBottom: 14 }}>
                {(['Active', 'History', 'Net Worth'] as const).map((t) => (
                    <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
                ))}
            </div>

            {/* ACTIVE LIABILITIES */}
            {tab === 'Active' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                        <button className="btn btn-primary" onClick={openAdd}><Plus size={13} /> Add Liability</button>
                    </div>
                    {msg && <div style={{ textAlign: 'center', marginBottom: 8, color: '#1DB98A', fontWeight: 600 }}>{msg}</div>}
                    {payMsg && <div style={{ textAlign: 'center', marginBottom: 8, color: '#1DB98A', fontWeight: 600 }}>{payMsg}</div>}

                    {activeLiabilities.length === 0 && (
                        <GlassCard style={{ textAlign: 'center', padding: 32 }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)' }}>No active liabilities!</div>
                        </GlassCard>
                    )}

                    {activeLiabilities.map((l) => {
                        const tInfo = typeInfo(l.liability_type)
                        const status = computeLiabilityStatus(l, payments)
                        const liabPayments = payments.filter((p) => p.liability_id === l.id).sort((a, b) => b.payment_date.localeCompare(a.payment_date))
                        const pColor = PRIORITY_COLORS[l.priority_level] || '#7B74FF'

                        return (
                            <GlassCard key={l.id} accentColor={tInfo.color} style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        <span className="badge" style={{ background: `${tInfo.color}20`, color: tInfo.color }}>{tInfo.label}</span>
                                        {l.priority_level && (
                                            <span className="badge" style={{ background: `${pColor}20`, color: pColor }}>{l.priority_level}</span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn btn-ghost" style={{ padding: '4px 6px' }} onClick={() => openEdit(l)}><Edit2 size={11} /></button>
                                        <button className="btn btn-red" style={{ padding: '4px 6px' }} onClick={() => deleteLiability(l.id)}><Trash2 size={11} /></button>
                                    </div>
                                </div>

                                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{l.name}</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
                                    {INTEREST_METHODS.find((m) => m.key === l.interest_method)?.label || l.interest_method}
                                </div>

                                <div style={{ fontWeight: 800, fontSize: 24, color: tInfo.color, marginBottom: 8 }}>
                                    {fmt(status.remaining)}
                                </div>

                                <div style={{ marginBottom: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>Progress Paid</span>
                                        <span style={{ color: '#1DB98A', fontWeight: 700 }}>{status.progressPct.toFixed(0)}%</span>
                                    </div>
                                    <div className="progress-bar" style={{ height: 6 }}>
                                        <div className="progress-fill" style={{ width: `${status.progressPct}%`, background: '#1DB98A' }} />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                                    {[
                                        { label: 'Principal', value: fmt(l.principal_amount || 0) },
                                        { label: 'Rate', value: `${l.interest_rate || 0}%/mo` },
                                        { label: 'Monthly', value: fmt(status.displayMonthly) },
                                    ].map((s) => (
                                        <div key={s.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 4px' }}>
                                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 2 }}>{s.label}</div>
                                            <div style={{ fontWeight: 700, fontSize: 11, color: tInfo.color }}>{s.value}</div>
                                        </div>
                                    ))}
                                </div>

                                {(status.arrears > 0) && (
                                    <div style={{ background: 'rgba(224,85,85,0.1)', border: '0.5px solid rgba(224,85,85,0.2)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#E05555', marginBottom: 8 }}>
                                        ⚠️ Overdue: {fmt(status.arrears)}
                                        {status.penalty > 0 && ` · Penalty: ${fmt(status.penalty)}`}
                                    </div>
                                )}
                                {(status.advance > 0) && (
                                    <div style={{ background: 'rgba(29,185,138,0.1)', border: '0.5px solid rgba(29,185,138,0.2)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#1DB98A', marginBottom: 8 }}>
                                        ✅ Advance: {fmt(status.advance)}
                                    </div>
                                )}
                                {l.end_date && (
                                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>Ends: {l.end_date}</div>
                                )}
                                {l.note && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>{l.note}</div>}

                                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => openPayment(l)}>
                                    <DollarSign size={13} /> Pay
                                </button>

                                {liabPayments.length > 0 && (
                                    <div style={{ marginTop: 10 }}>
                                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Recent Payments</div>
                                        {liabPayments.slice(0, 3).map((p) => (
                                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                                                    {p.payment_date}{p.is_future ? ' (future)' : ''}{p.note ? ` · ${p.note}` : ''}
                                                </span>
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 700, color: '#1DB98A' }}>{fmt(p.amount)}</span>
                                                    <button className="btn btn-red" style={{ padding: '2px 5px', fontSize: 10 }} onClick={() => deletePayment(p)}>✕</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </GlassCard>
                        )
                    })}
                </div>
            )}

            {/* HISTORY */}
            {tab === 'History' && (
                <div>
                    {completedLiabilities.length > 0 && (
                        <GlassCard style={{ marginBottom: 12 }}>
                            <div style={{ fontWeight: 700, marginBottom: 14 }}>Completed Liabilities 🎉</div>
                            {completedLiabilities.map(l => {
                                const tInfo = typeInfo(l.liability_type)
                                return (
                                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 13, textDecoration: 'line-through', color: 'rgba(255,255,255,0.5)' }}>{l.name}</div>
                                            <div style={{ fontSize: 11, color: tInfo.color }}>Fully Paid Off</div>
                                        </div>
                                        <button className="btn btn-red" style={{ padding: '4px 6px' }} onClick={() => deleteLiability(l.id)}><Trash2 size={11} /></button>
                                    </div>
                                )
                            })}
                        </GlassCard>
                    )}

                    <GlassCard>
                        <div style={{ fontWeight: 700, marginBottom: 14 }}>All Payments</div>
                        {payments.length === 0 && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: 24 }}>No payments yet</div>}
                        {payments.map((p) => {
                            const liab = liabilities.find((l) => l.id === p.liability_id)
                            return (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{liab?.name || 'Unknown'}</div>
                                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                                            {p.payment_date}{p.is_future ? ' · future' : ''}{p.note ? ` · ${p.note}` : ''}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700, color: '#1DB98A' }}>{fmt(p.amount)}</span>
                                        <button className="btn btn-red" style={{ padding: '3px 6px', fontSize: 11 }} onClick={() => deletePayment(p)}>
                                            <Trash2 size={11} />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </GlassCard>
                </div>
            )}

            {/* NET WORTH */}
            {tab === 'Net Worth' && (
                <div>
                    <GlassCard accentColor={netWorth >= 0 ? '#1DB98A' : '#E05555'} style={{ marginBottom: 12, textAlign: 'center' }}>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Net Worth</div>
                        <div style={{ fontWeight: 800, fontSize: 32, color: netWorth >= 0 ? '#1DB98A' : '#E05555' }}>{fmt(netWorth)}</div>
                    </GlassCard>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                        <GlassCard accentColor="#1DB98A" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Total Assets</div>
                            <div style={{ fontWeight: 800, fontSize: 18, color: '#1DB98A' }}>{fmt(totalAssets)}</div>
                        </GlassCard>
                        <GlassCard accentColor="#E05555" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Total Debts</div>
                            <div style={{ fontWeight: 800, fontSize: 18, color: '#E05555' }}>{fmt(totalLiabRemaining)}</div>
                        </GlassCard>
                    </div>
                    <GlassCard>
                        <div style={{ fontWeight: 700, marginBottom: 14 }}>
                            <TrendingDown size={15} color="#E05577" style={{ display: 'inline', marginRight: 6 }} />
                            Liability Breakdown
                        </div>
                        {activeLiabilities.length === 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>No active liabilities</div>}
                        {activeLiabilities.map((l) => {
                            const tInfo = typeInfo(l.liability_type)
                            const status = computeLiabilityStatus(l, payments)
                            const pct = (l.priority_percent || 0)
                            return (
                                <div key={l.id} style={{ marginBottom: 14 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>{l.name}</span>
                                        <span style={{ fontWeight: 700, color: tInfo.color }}>{fmt(status.remaining)}</span>
                                    </div>
                                    {pct > 0 && (
                                        <div className="progress-bar">
                                            <div className="progress-fill" style={{ width: `${Math.min(100, pct)}%`, background: tInfo.color }} />
                                        </div>
                                    )}
                                    {pct > 0 && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{pct}% of income allocated</div>}
                                </div>
                            )
                        })}
                    </GlassCard>
                </div>
            )}

            {/* ADD/EDIT MODAL */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-handle" />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{editLiab ? 'Edit' : 'Add'} Liability — Step {modalStep}/4</div>
                            <div style={{ display: 'flex', gap: 4 }}>
                                {[1, 2, 3, 4].map((s) => (
                                    <div key={s} style={{ width: 8, height: 8, borderRadius: '50%', background: modalStep >= s ? '#7B74FF' : 'rgba(255,255,255,0.15)' }} />
                                ))}
                            </div>
                        </div>

                        {modalStep === 1 && (
                            <div>
                                <div className="field-group">
                                    <div className="field-label">Name</div>
                                    <input type="text" className="input-field" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Bank Loan" />
                                </div>
                                <div className="field-group">
                                    <div className="field-label">Type</div>
                                    {LIABILITY_TYPES.map((t) => (
                                        <button key={t.key} onClick={() => setForm((p) => ({ ...p, liability_type: t.key, interest_method: t.defaultMethod }))}
                                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 10, marginBottom: 6, border: `1px solid ${form.liability_type === t.key ? t.color : 'rgba(255,255,255,0.08)'}`, background: form.liability_type === t.key ? `${t.color}15` : 'rgba(255,255,255,0.04)', color: form.liability_type === t.key ? t.color : 'rgba(255,255,255,0.7)', fontWeight: 600, cursor: 'pointer' }}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {modalStep === 2 && (
                            <div>
                                <div className="field-group">
                                    <div className="field-label">Interest Method</div>
                                    {INTEREST_METHODS.map((m) => (
                                        <button key={m.key} onClick={() => setForm((p) => ({ ...p, interest_method: m.key }))}
                                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 10, marginBottom: 6, border: `1px solid ${form.interest_method === m.key ? '#7B74FF' : 'rgba(255,255,255,0.08)'}`, background: form.interest_method === m.key ? 'rgba(123,116,255,0.15)' : 'rgba(255,255,255,0.04)', color: form.interest_method === m.key ? '#7B74FF' : 'rgba(255,255,255,0.7)', fontWeight: 600, cursor: 'pointer' }}>
                                            <div>{m.label}</div>
                                            <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 400 }}>{m.desc}</div>
                                        </button>
                                    ))}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className="field-group">
                                        <div className="field-label">Principal (Rs.)</div>
                                        <input type="number" className="input-field" value={form.principal_amount} onChange={(e) => setForm((p) => ({ ...p, principal_amount: e.target.value }))} placeholder="0" />
                                    </div>
                                    <div className="field-group">
                                        <div className="field-label">Interest Rate (%/mo)</div>
                                        <input type="number" className="input-field" value={form.interest_rate} onChange={(e) => setForm((p) => ({ ...p, interest_rate: e.target.value }))} placeholder="0" />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className="field-group">
                                        <div className="field-label">Monthly Payment</div>
                                        <input type="number" className="input-field" value={form.monthly_payment} onChange={(e) => setForm((p) => ({ ...p, monthly_payment: e.target.value }))} placeholder="0" />
                                    </div>
                                    <div className="field-group">
                                        <div className="field-label">Arrears (Rs.)</div>
                                        <input type="number" className="input-field" value={form.arrears_amount} onChange={(e) => setForm((p) => ({ ...p, arrears_amount: e.target.value }))} placeholder="0" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {modalStep === 3 && (
                            <div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className="field-group">
                                        <div className="field-label">Payment Day (1-31)</div>
                                        <input type="number" className="input-field" value={form.payment_day} onChange={(e) => setForm((p) => ({ ...p, payment_day: e.target.value }))} min={1} max={31} />
                                    </div>
                                    <div className="field-group">
                                        <div className="field-label">Start Date</div>
                                        <input type="date" className="input-field" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="field-group">
                                    <div className="field-label">End Date</div>
                                    <input type="date" className="input-field" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
                                </div>
                                {form.start_date && form.end_date && (
                                    <div style={{ fontSize: 12, color: '#7B74FF', marginBottom: 8 }}>
                                        Duration: {calcMonthsRemaining(form.start_date, form.end_date)} months
                                    </div>
                                )}
                                {form.principal_amount && form.interest_rate && form.start_date && form.end_date && form.interest_method !== 'none' && form.interest_method !== 'interest_only' && (
                                    <div style={{ fontSize: 12, color: '#1DB98A', marginBottom: 8 }}>
                                        Est. total interest: {fmt(calcTotalInterest(parseFloat(form.principal_amount), parseFloat(form.interest_rate), form.interest_method, calcMonthsRemaining(form.start_date, form.end_date)))}
                                    </div>
                                )}
                                <div className="field-group">
                                    <div className="field-label">Note / Remark</div>
                                    <textarea className="input-field" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} rows={2} style={{ resize: 'none' }} />
                                </div>
                            </div>
                        )}

                        {modalStep === 4 && (
                            <div>
                                <div className="field-group">
                                    <div className="field-label">Priority Level</div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {PRIORITY_LEVELS.map((lv) => (
                                            <button key={lv} onClick={() => setForm((p) => ({ ...p, priority_level: lv }))}
                                                style={{ flex: 1, padding: '10px', borderRadius: 10, fontWeight: 700, border: `1px solid ${form.priority_level === lv ? PRIORITY_COLORS[lv] : 'rgba(255,255,255,0.1)'}`, background: form.priority_level === lv ? `${PRIORITY_COLORS[lv]}20` : 'rgba(255,255,255,0.04)', color: form.priority_level === lv ? PRIORITY_COLORS[lv] : 'rgba(255,255,255,0.5)', cursor: 'pointer', textTransform: 'capitalize' }}>
                                                {lv}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="field-group">
                                    <div className="field-label">Budget Allocation (% of income)</div>
                                    <input type="number" className="input-field" value={form.priority_percent} onChange={(e) => setForm((p) => ({ ...p, priority_percent: e.target.value }))} placeholder="0" max={100} />
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                            {modalStep > 1 && <button className="btn btn-ghost" onClick={() => setModalStep((s) => s - 1)}>Back</button>}
                            {modalStep < 4
                                ? <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setModalStep((s) => s + 1)}>Next</button>
                                : <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveLiability}>Save Liability</button>
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* PAYMENT MODAL */}
            {payLiab && (
                <div className="modal-overlay" onClick={() => setPayLiab(null)}>
                    <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-handle" />
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Pay — {payLiab.name}</div>
                        <div className="field-group">
                            <div className="field-label">Amount (Rs.)</div>
                            <input type="number" className="input-field" value={payForm.amount} onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))} />
                        </div>
                        <div className="field-group">
                            <div className="field-label">Payment Date</div>
                            <input type="date" className="input-field" value={payForm.payment_date} onChange={(e) => setPayForm((p) => ({ ...p, payment_date: e.target.value }))} />
                        </div>
                        {payForm.payment_date > todayStr() && (
                            <div style={{ background: 'rgba(212,168,67,0.1)', border: '0.5px solid rgba(212,168,67,0.3)', borderRadius: 10, padding: '8px 12px', color: '#D4A843', fontSize: 12, marginBottom: 10 }}>
                                ⚠️ Future payment — bank balance will NOT be deducted now.
                            </div>
                        )}
                        <div className="field-group">
                            <div className="field-label">Note</div>
                            <input type="text" className="input-field" value={payForm.note} onChange={(e) => setPayForm((p) => ({ ...p, note: e.target.value }))} placeholder="Optional" />
                        </div>
                        <div className="field-group">
                            <div className="field-label">Pay From</div>
                            <BankPicker banks={banks} selectedId={payForm.bank_id} onSelect={(id) => setPayForm((p) => ({ ...p, bank_id: id }))} excludeTypes={['liability']} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={savePayment}>
                                <DollarSign size={13} /> Record Payment
                            </button>
                            <button className="btn btn-ghost" onClick={() => setPayLiab(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
