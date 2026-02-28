'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt, todayStr, firstDayOfMonth, lastDayOfMonth, monthLabel, toISO, calcNextDate } from '@/lib/utils'
import { EXPENSE_CATEGORIES } from '@/lib/theme'
import GlassCard from '@/components/ui/GlassCard'
import BankPicker from '@/components/ui/BankPicker'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { Plus, Trash2, Edit2, Calendar, Trophy } from 'lucide-react'

export default function ExpensesPage() {
    const [tab, setTab] = useState<'Log' | 'Analytics' | 'Budgets' | 'Recurring'>('Log')
    const today = todayStr()

    // === LOG TAB ===
    const [logDate, setLogDate] = useState(today)
    const [logDateInput, setLogDateInput] = useState(today)
    const [logCategory, setLogCategory] = useState('')
    const [logAmount, setLogAmount] = useState('')
    const [logNote, setLogNote] = useState('')
    const [logBankId, setLogBankId] = useState<string | null>(null)
    const [banks, setBanks] = useState<any[]>([])
    const [prefs, setPrefs] = useState<any>(null)
    const [todayExpenses, setTodayExpenses] = useState<any[]>([])
    const [customCategories, setCustomCategories] = useState<any[]>([])
    const [editExpId, setEditExpId] = useState<string | null>(null)
    const [logMsg, setLogMsg] = useState('')
    const [allCategories, setAllCategories] = useState([...EXPENSE_CATEGORIES])

    // === ANALYTICS ===
    const [monthExpenses, setMonthExpenses] = useState<any[]>([])
    const [monthTrend, setMonthTrend] = useState<any[]>([])

    // === BUDGETS ===
    const [budgets, setBudgets] = useState<any[]>([])
    const [budgetEdits, setBudgetEdits] = useState<Record<string, string>>({})
    const [budgetMsg, setBudgetMsg] = useState('')

    // === RECURRING ===
    const [recurring, setRecurring] = useState<any[]>([])
    const [recForm, setRecForm] = useState({ name: '', category: '', amount: '', frequency: 'monthly', next_date: today, note: '' })
    const [editRecId, setEditRecId] = useState<string | null>(null)
    const [recMsg, setRecMsg] = useState('')

    const QUICK_AMOUNTS = [100, 200, 500, 1000, 1500]

    const fetchBase = useCallback(async () => {
        const [b, p, cats, latestIncRes] = await Promise.all([
            supabase.from('banks').select('id,name,account_type,current_balance').eq('is_active', true).order('sort_order'),
            supabase.from('preferences').select('*').eq('id', 'default').single(),
            supabase.from('expense_categories').select('*').order('name'),
            supabase.from('income_records').select('app, wallet_balance, date').eq('income_type', 'main').order('date', { ascending: false })
        ])
        if (b.data) {
            let processedBanks = b.data;
            if (latestIncRes.data) {
                const latestUber = latestIncRes.data.find((r) => r.app === 'Uber')
                const latestPickMe = latestIncRes.data.find((r) => r.app === 'PickMe')
                processedBanks = processedBanks.map((bank) => {
                    if (bank.name === 'Uber Wallet' && latestUber) return { ...bank, current_balance: latestUber.wallet_balance || 0 }
                    if (bank.name === 'PickMe Wallet' && latestPickMe) return { ...bank, current_balance: latestPickMe.wallet_balance || 0 }
                    return bank
                })
            }
            setBanks(processedBanks)
        }
        if (p.data) setPrefs(p.data)
        if (cats.data) {
            setCustomCategories(cats.data)
            const defaultSet = new Set(EXPENSE_CATEGORIES.map(c => c.key));
            const newCats = cats.data
                .filter((c: any) => !defaultSet.has(c.key))
                .map((c: any) => ({ key: c.key, label: c.name, color: c.color || '#7B74FF', icon: '📌' }));
            setAllCategories([...EXPENSE_CATEGORIES, ...newCats]);
        }
    }, [])

    const fetchLogExpenses = useCallback(async () => {
        const res = await supabase.from('daily_expenses').select('*').eq('date', logDate).order('created_at')
        if (res.data) setTodayExpenses(res.data)
    }, [logDate])

    const fetchAnalytics = useCallback(async () => {
        const first = firstDayOfMonth(today)
        const last = lastDayOfMonth(today)
        const res = await supabase.from('daily_expenses').select('*').gte('date', first).lte('date', last)
        if (res.data) setMonthExpenses(res.data)

        // Trend last 6 months
        const months = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i))
            const str = toISO(d)
            return { first: firstDayOfMonth(str), last: lastDayOfMonth(str), label: monthLabel(str) }
        })
        const trendRes = await supabase.from('daily_expenses').select('date,amount')
            .gte('date', months[0].first).lte('date', months[5].last)
        const trendData = months.map((m) => ({
            label: m.label,
            total: (trendRes.data || []).filter((r: any) => r.date >= m.first && r.date <= m.last)
                .reduce((s: number, r: any) => s + (r.amount || 0), 0)
        }))
        setMonthTrend(trendData)
    }, [today])

    const fetchBudgets = useCallback(async () => {
        const res = await supabase.from('expense_budgets').select('*')
        if (res.data) setBudgets(res.data)
    }, [])

    const fetchRecurring = useCallback(async () => {
        const res = await supabase.from('recurring_expenses').select('*').order('next_date')
        if (res.data) setRecurring(res.data)
    }, [])

    useEffect(() => { fetchBase() }, [fetchBase])
    useEffect(() => { fetchLogExpenses() }, [fetchLogExpenses])
    useEffect(() => { if (tab === 'Analytics') fetchAnalytics() }, [tab, fetchAnalytics])
    useEffect(() => { if (tab === 'Budgets') { fetchBudgets(); fetchAnalytics() } }, [tab, fetchBudgets, fetchAnalytics])
    useEffect(() => { if (tab === 'Recurring') fetchRecurring() }, [tab, fetchRecurring])

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const d = params.get('date');
            const editId = params.get('edit_id');
            if (d && editId) {
                setLogDate(d);
                setLogDateInput(d);
                setEditExpId(editId);

                // Fetch specifically to populate the form right away
                supabase.from('daily_expenses').select('*').eq('id', editId).single().then(({ data }) => {
                    if (data) {
                        setLogCategory(data.category || '');
                        setLogAmount(data.amount ? String(data.amount) : '');
                        setLogNote(data.note || '');
                        setLogBankId(data.bank_id);
                    }
                })
            }
        }
    }, [])

    const isFuture = logDate > today

    const saveLogExpense = async () => {
        if (!logCategory || !logAmount || !logBankId) { alert('Fill category, amount, and select bank'); return }
        const amt = parseFloat(logAmount)
        if (editExpId) {
            const old = todayExpenses.find((e) => e.id === editExpId)
            if (!old) return
            await supabase.from('daily_expenses').update({ date: logDate, category: logCategory, amount: amt, note: logNote, bank_id: logBankId }).eq('id', editExpId)
            // Reverse old, apply new
            const bank = banks.find((b) => b.id === logBankId)
            if (bank) {
                let newBal = bank.current_balance
                if (old.date <= today) newBal += (old.amount || 0)
                if (logDate <= today) newBal -= amt
                await supabase.from('banks').update({ current_balance: newBal }).eq('id', logBankId)
            }
            // Fuel prefs update if either old or new is fuel
            if (old.category === 'fuel' || logCategory === 'fuel') {
                if (prefs) {
                    const delta = (logCategory === 'fuel' ? amt : 0) - (old.category === 'fuel' ? (old.amount || 0) : 0)
                    const litersAdded = delta / (prefs.petrol_price_per_liter || 370)
                    const newL = Math.min(Math.max(0, prefs.fuel_liters_current + litersAdded), prefs.fuel_tank_capacity_liters || 10.5)
                    await supabase.from('preferences').update({ fuel_liters_current: Math.round(newL * 100) / 100, current_fuel_range_km: Math.round(newL * (prefs.fuel_efficiency_km_per_liter || 30)) }).eq('id', 'default')
                }
            }
            setEditExpId(null)
        } else {
            await supabase.from('daily_expenses').insert({ date: logDate, category: logCategory, amount: amt, note: logNote, bank_id: logBankId })
            if (!isFuture) {
                const bank = banks.find((b) => b.id === logBankId)
                if (bank) await supabase.from('banks').update({ current_balance: bank.current_balance - amt }).eq('id', logBankId)
            }
            if (logCategory === 'fuel' && prefs && !isFuture) {
                const litersAdded = amt / (prefs.petrol_price_per_liter || 370)
                const newL = Math.min(Math.max(0, prefs.fuel_liters_current + litersAdded), prefs.fuel_tank_capacity_liters || 10.5)
                await supabase.from('preferences').update({ fuel_liters_current: Math.round(newL * 100) / 100, current_fuel_range_km: Math.round(newL * (prefs.fuel_efficiency_km_per_liter || 30)) }).eq('id', 'default')
            }
        }

        setLogCategory(''); setLogAmount(''); setLogNote('')
        setLogMsg('✅ Saved!'); setTimeout(() => setLogMsg(''), 2500)

        // Remove edit query parameters to prevent re-opening on manual reload
        if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);

        fetchLogExpenses(); fetchBase()
    }


    const deleteLogExpense = async (exp: any) => {
        if (!confirm('Delete expense?')) return
        await supabase.from('daily_expenses').delete().eq('id', exp.id)
        if (exp.date <= today && exp.bank_id) {
            const bank = banks.find((b) => b.id === exp.bank_id)
            if (bank) await supabase.from('banks').update({ current_balance: bank.current_balance + (exp.amount || 0) }).eq('id', exp.bank_id)
        }
        if (exp.category === 'fuel' && prefs) {
            const liters = (exp.amount || 0) / (prefs.petrol_price_per_liter || 370)
            const newL = Math.max(0, prefs.fuel_liters_current - liters)
            await supabase.from('preferences').update({ fuel_liters_current: Math.round(newL * 100) / 100, current_fuel_range_km: Math.round(newL * (prefs.fuel_efficiency_km_per_liter || 30)) }).eq('id', 'default')
        }
        fetchLogExpenses(); fetchBase()
    }

    const saveBudget = async () => {
        const entries = Object.entries(budgetEdits)
        for (const [category, val] of entries) {
            const limit = parseFloat(val) || 0
            await supabase.from('expense_budgets').upsert({ category, monthly_limit: limit }, { onConflict: 'category' })
        }
        setBudgetEdits({})
        setBudgetMsg('✅ Budgets updated!'); setTimeout(() => setBudgetMsg(''), 2500)
        fetchBudgets()
    }

    const postNow = async (rec: any) => {
        if (!confirm(`Post "${rec.name}" now?`)) return
        await supabase.from('daily_expenses').insert({ date: today, category: rec.category, amount: rec.amount, note: rec.note })
        const nextDate = calcNextDate(rec.next_date, rec.frequency)
        await supabase.from('recurring_expenses').update({ next_date: nextDate }).eq('id', rec.id)
        fetchRecurring()
    }

    const toggleActive = async (id: string, val: boolean) => {
        await supabase.from('recurring_expenses').update({ is_active: !val }).eq('id', id)
        fetchRecurring()
    }

    const saveRec = async () => {
        if (!recForm.name || !recForm.category || !recForm.amount) { alert('Fill all required fields'); return }
        const row = { name: recForm.name, category: recForm.category, amount: parseFloat(recForm.amount), frequency: recForm.frequency, next_date: recForm.next_date, note: recForm.note }
        if (editRecId) {
            await supabase.from('recurring_expenses').update(row).eq('id', editRecId)
            setEditRecId(null)
        } else {
            await supabase.from('recurring_expenses').insert({ ...row, is_active: true })
        }
        setRecForm({ name: '', category: '', amount: '', frequency: 'monthly', next_date: today, note: '' })
        setRecMsg('✅ Saved!'); setTimeout(() => setRecMsg(''), 2500)
        fetchRecurring()
    }

    const deleteRec = async (id: string) => {
        if (!confirm('Delete recurring expense?')) return
        await supabase.from('recurring_expenses').delete().eq('id', id)
        fetchRecurring()
    }

    // Analytics computed
    const totalMonthSpent = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0)
    const dayOfMonth = new Date().getDate()
    const dailyAvg = dayOfMonth > 0 ? totalMonthSpent / dayOfMonth : 0

    const byCategory = allCategories.map((cat) => {
        const total = monthExpenses.filter((e) => e.category === cat.key).reduce((s, e) => s + (e.amount || 0), 0)
        return { ...cat, total }
    }).filter((c) => c.total > 0)

    const highestCat = byCategory.sort((a, b) => b.total - a.total)[0]
    const donutData = byCategory.map((c) => ({ name: c.label, value: c.total, color: c.color }))

    // Budget computed
    const monthExpensesForBudget = monthExpenses
    const budgetMap: Record<string, number> = {}
    monthExpensesForBudget.forEach((e) => { budgetMap[e.category] = (budgetMap[e.category] || 0) + (e.amount || 0) })

    const getCatInfo = (key: string) => allCategories.find((c) => c.key === key) || { label: key, color: '#7B74FF', icon: '📌' }

    return (
        <div className="fade-in">
            <div className="tab-bar" style={{ marginBottom: 14 }}>
                {(['Log', 'Analytics', 'Budgets', 'Recurring'] as const).map((t) => (
                    <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
                ))}
            </div>

            {/* ===== LOG TAB ===== */}
            {tab === 'Log' && (
                <div>
                    <GlassCard style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <Calendar size={14} color="#E8854A" />
                            <span style={{ fontWeight: 700 }}>Log Expense</span>
                            <input type="date" value={logDateInput} max={today}
                                onChange={(e) => { setLogDate(e.target.value); setLogDateInput(e.target.value) }}
                                style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', padding: '4px 8px', fontSize: 12 }} />
                        </div>

                        {isFuture && (
                            <div style={{ background: 'rgba(212,168,67,0.1)', border: '0.5px solid rgba(212,168,67,0.3)', borderRadius: 10, padding: '8px 12px', color: '#D4A843', fontSize: 12, marginBottom: 12 }}>
                                ⚠️ Future date — balance will NOT be deducted immediately.
                            </div>
                        )}

                        <div className="field-group">
                            <div className="field-label">Pay From Account</div>
                            <BankPicker banks={banks} selectedId={logBankId} onSelect={setLogBankId} excludeTypes={['liability']} />
                        </div>

                        <div className="field-group">
                            <div className="field-label">Category</div>
                            <div className="chip-scroll">
                                {allCategories.map((cat) => (
                                    <button key={cat.key} className={`chip${logCategory === cat.key ? ' active' : ''}`}
                                        onClick={() => setLogCategory(logCategory === cat.key ? '' : cat.key)}
                                        style={{ borderColor: logCategory === cat.key ? cat.color : undefined, color: logCategory === cat.key ? cat.color : undefined, background: logCategory === cat.key ? `${cat.color}20` : undefined }}>
                                        {cat.icon} {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="field-group">
                            <div className="field-label">Amount (Rs.)</div>
                            <div className="chip-scroll" style={{ marginBottom: 8 }}>
                                {QUICK_AMOUNTS.map((v) => (
                                    <button key={v} className={`chip${logAmount === String(v) ? ' active' : ''}`}
                                        onClick={() => setLogAmount(logAmount === String(v) ? '' : String(v))}>
                                        Rs.{v.toLocaleString()}
                                    </button>
                                ))}
                            </div>
                            <input type="number" className="input-field" value={logAmount} onChange={(e) => setLogAmount(e.target.value)} placeholder="0" />
                        </div>

                        <div className="field-group">
                            <div className="field-label">Note (optional)</div>
                            <input type="text" className="input-field" value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="Note" />
                        </div>

                        <button className="btn btn-orange" style={{ width: '100%' }} onClick={saveLogExpense}>
                            <Plus size={14} /> {editExpId ? 'Update Expense' : 'Log Expense'}
                        </button>
                        {logMsg && <div style={{ textAlign: 'center', marginTop: 8, color: '#1DB98A', fontWeight: 600 }}>{logMsg}</div>}
                    </GlassCard>

                    {todayExpenses.length > 0 && (
                        <GlassCard>
                            <div style={{ fontWeight: 700, marginBottom: 12 }}>
                                Expenses for {logDate === today ? 'Today' : logDate}
                            </div>
                            {todayExpenses.map((exp) => {
                                const cat = getCatInfo(exp.category)
                                return (
                                    <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${cat.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                                                {cat.icon}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{cat.label}</div>
                                                {exp.note && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{exp.note}</div>}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontWeight: 700, color: cat.color }}>{fmt(exp.amount)}</span>
                                            <button className="btn btn-ghost" style={{ padding: '4px 6px' }}
                                                onClick={() => {
                                                    setEditExpId(exp.id); setLogCategory(exp.category); setLogAmount(String(exp.amount)); setLogNote(exp.note || ''); setLogBankId(exp.bank_id)
                                                }}>
                                                <Edit2 size={12} />
                                            </button>
                                            <button className="btn btn-red" style={{ padding: '4px 6px' }} onClick={() => deleteLogExpense(exp)}>
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Total</span>
                                <span style={{ color: '#E05555' }}>{fmt(todayExpenses.reduce((s, e) => s + (e.amount || 0), 0))}</span>
                            </div>
                        </GlassCard>
                    )}
                </div>
            )}

            {/* ===== ANALYTICS TAB ===== */}
            {tab === 'Analytics' && (
                <div>
                    {/* Summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                        {[
                            { label: 'Total Spent', value: fmt(totalMonthSpent), color: '#E05555' },
                            { label: 'Daily Avg', value: fmt(dailyAvg), color: '#E8854A' },
                            { label: 'Entries', value: String(monthExpenses.length), color: '#7B74FF' },
                        ].map((s) => (
                            <GlassCard key={s.label} style={{ textAlign: 'center', padding: 12 }}>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{s.label}</div>
                                <div style={{ fontWeight: 800, fontSize: 15, color: s.color }}>{s.value}</div>
                            </GlassCard>
                        ))}
                    </div>

                    {/* Donut */}
                    {donutData.length > 0 ? (
                        <GlassCard style={{ marginBottom: 12 }}>
                            <div style={{ fontWeight: 700, marginBottom: 12 }}>📊 This Month Breakdown</div>
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={2}>
                                        {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} formatter={(val: any) => [fmt(val), ''] as any} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {donutData.map((c) => (
                                    <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, display: 'inline-block' }} />
                                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>{c.name}</span>
                                        <span style={{ fontWeight: 700, color: c.color }}>
                                            {totalMonthSpent > 0 ? ((c.value / totalMonthSpent) * 100).toFixed(0) : 0}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </GlassCard>
                    ) : (
                        <GlassCard style={{ textAlign: 'center', padding: 32, marginBottom: 12 }}>
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 32, marginBottom: 8 }}>📊</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)' }}>No expenses this month</div>
                        </GlassCard>
                    )}

                    {/* Highest cat */}
                    {highestCat && (
                        <GlassCard accentColor={highestCat.color} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Trophy size={20} color={highestCat.color} />
                                <div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Highest Expense</div>
                                    <div style={{ fontWeight: 700 }}>{highestCat.label} — {fmt(highestCat.total)}</div>
                                </div>
                            </div>
                        </GlassCard>
                    )}

                    {/* Trend */}
                    <GlassCard>
                        <div style={{ fontWeight: 700, marginBottom: 12 }}>📈 Monthly Trend</div>
                        <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={monthTrend}>
                                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis hide />
                                <Tooltip contentStyle={{ background: '#1a1a2e', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} formatter={(val: any) => [fmt(val), ''] as any} />
                                <Bar dataKey="total" name="Expenses" fill="#E05555" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </GlassCard>
                </div>
            )}

            {/* ===== BUDGETS TAB ===== */}
            {tab === 'Budgets' && (
                <div>
                    <GlassCard style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, marginBottom: 14 }}>💰 Monthly Budgets</div>
                        {allCategories.map((cat) => {
                            const spent = budgetMap[cat.key] || 0
                            const budgetRow = budgets.find((b) => b.category === cat.key)
                            const limit = parseFloat(budgetEdits[cat.key] ?? String(budgetRow?.monthly_limit ?? '0'))
                            const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
                            const barColor = pct >= 100 ? '#E05555' : pct >= 80 ? '#E8854A' : '#1DB98A'

                            return (
                                <div key={cat.key} style={{ marginBottom: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 14 }}>{cat.icon}</span>
                                            <span style={{ fontWeight: 600, fontSize: 13 }}>{cat.label}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{fmt(spent)}</span>
                                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>/</span>
                                            <input type="number" value={budgetEdits[cat.key] ?? String(budgetRow?.monthly_limit ?? '')}
                                                onChange={(e) => setBudgetEdits((prev) => ({ ...prev, [cat.key]: e.target.value }))}
                                                placeholder="Budget"
                                                style={{ width: 80, textAlign: 'right', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', padding: '4px 8px', fontSize: 12 }} />
                                        </div>
                                    </div>
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
                                    </div>
                                </div>
                            )
                        })}
                        <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={saveBudget}>
                            Save Budgets
                        </button>
                        {budgetMsg && <div style={{ textAlign: 'center', marginTop: 8, color: '#1DB98A', fontWeight: 600 }}>{budgetMsg}</div>}
                    </GlassCard>
                </div>
            )}

            {/* ===== RECURRING TAB ===== */}
            {tab === 'Recurring' && (
                <div>
                    <GlassCard style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, marginBottom: 12 }}>🔄 {editRecId ? 'Edit' : 'Add'} Recurring</div>
                        <div className="field-group">
                            <div className="field-label">Name</div>
                            <input type="text" className="input-field" value={recForm.name} onChange={(e) => setRecForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Netflix" />
                        </div>
                        <div className="field-group">
                            <div className="field-label">Category</div>
                            <div className="chip-scroll">
                                {allCategories.map((cat) => (
                                    <button key={cat.key} className={`chip${recForm.category === cat.key ? ' active' : ''}`}
                                        onClick={() => setRecForm((p) => ({ ...p, category: cat.key }))}>
                                        {cat.icon} {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div className="field-group">
                                <div className="field-label">Amount (Rs.)</div>
                                <input type="number" className="input-field" value={recForm.amount} onChange={(e) => setRecForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0" />
                            </div>
                            <div className="field-group">
                                <div className="field-label">Next Date</div>
                                <input type="date" className="input-field" value={recForm.next_date} onChange={(e) => setRecForm((p) => ({ ...p, next_date: e.target.value }))} />
                            </div>
                        </div>
                        <div className="field-group">
                            <div className="field-label">Frequency</div>
                            <div className="tab-bar">
                                {['daily', 'weekly', 'monthly', 'yearly'].map((f) => (
                                    <button key={f} className={`tab-btn${recForm.frequency === f ? ' active' : ''}`}
                                        onClick={() => setRecForm((p) => ({ ...p, frequency: f }))}>
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="field-group">
                            <div className="field-label">Note</div>
                            <input type="text" className="input-field" value={recForm.note} onChange={(e) => setRecForm((p) => ({ ...p, note: e.target.value }))} placeholder="Optional" />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveRec}>
                                <Plus size={14} /> {editRecId ? 'Update' : 'Add'} Recurring
                            </button>
                            {editRecId && <button className="btn btn-ghost" onClick={() => { setEditRecId(null); setRecForm({ name: '', category: '', amount: '', frequency: 'monthly', next_date: today, note: '' }) }}>Cancel</button>}
                        </div>
                        {recMsg && <div style={{ textAlign: 'center', marginTop: 8, color: '#1DB98A', fontWeight: 600 }}>{recMsg}</div>}
                    </GlassCard>

                    {recurring.map((rec) => {
                        const cat = getCatInfo(rec.category)
                        const freqColors: Record<string, string> = { daily: '#1DB98A', weekly: '#4A9FD4', monthly: '#7B74FF', yearly: '#E8854A' }
                        return (
                            <GlassCard key={rec.id} style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                            <span className="badge" style={{ background: `${freqColors[rec.frequency]}20`, color: freqColors[rec.frequency] }}>
                                                {rec.frequency}
                                            </span>
                                            <span className="badge" style={{ background: `${cat.color}20`, color: cat.color }}>
                                                {cat.icon} {cat.label}
                                            </span>
                                        </div>
                                        <div style={{ fontWeight: 700 }}>{rec.name}</div>
                                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Next: {rec.next_date}</div>
                                        {rec.note && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{rec.note}</div>}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 800, fontSize: 16, color: '#E8854A' }}>{fmt(rec.amount)}</div>
                                        <div style={{ display: 'flex', gap: 5, marginTop: 8, justifyContent: 'flex-end' }}>
                                            <button className="btn btn-green" style={{ padding: '5px 8px', fontSize: 11 }} onClick={() => postNow(rec)}>Post</button>
                                            <button className="btn btn-ghost" style={{ padding: '5px 8px', fontSize: 11 }}
                                                onClick={() => { setEditRecId(rec.id); setRecForm({ name: rec.name, category: rec.category, amount: String(rec.amount), frequency: rec.frequency, next_date: rec.next_date, note: rec.note || '' }) }}>
                                                <Edit2 size={11} />
                                            </button>
                                            <button className="btn btn-red" style={{ padding: '5px 8px', fontSize: 11 }} onClick={() => deleteRec(rec.id)}>
                                                <Trash2 size={11} />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => toggleActive(rec.id, rec.is_active)}
                                            style={{ marginTop: 6, fontSize: 10, color: rec.is_active ? '#1DB98A' : 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                            {rec.is_active ? '● Active' : '○ Inactive'}
                                        </button>
                                    </div>
                                </div>
                            </GlassCard>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
