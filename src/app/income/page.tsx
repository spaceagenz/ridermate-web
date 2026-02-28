'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt, todayStr, toISO, addDays, firstDayOfMonth, lastDayOfMonth } from '@/lib/utils'
import GlassCard from '@/components/ui/GlassCard'
import MiniCalendar from '@/components/ui/MiniCalendar'
import BankPicker from '@/components/ui/BankPicker'
import ReportRow from '@/components/ui/ReportRow'
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit2, Tag } from 'lucide-react'

export default function IncomePage() {
    const [tab, setTab] = useState<'Main Income' | 'Side Hustle'>('Main Income')
    const [selectedDate, setSelectedDate] = useState(todayStr())
    const [showCal, setShowCal] = useState(false)
    const [banks, setBanks] = useState<any[]>([])
    const [prefs, setPrefs] = useState<any>(null)
    const [monthRecords, setMonthRecords] = useState<any[]>([])
    const [sideCategories, setSideCategories] = useState<any[]>([])

    // Main income form
    const [app, setApp] = useState<'Uber' | 'PickMe'>('Uber')
    const [startKm, setStartKm] = useState('')
    const [endKm, setEndKm] = useState('')
    const [dailyEarning, setDailyEarning] = useState('')
    const [cashOnHand, setCashOnHand] = useState('')
    const [walletBalance, setWalletBalance] = useState('')
    const [fuelExpense, setFuelExpense] = useState('')
    const [fuelBankId, setFuelBankId] = useState<string | null>(null)
    const [prevWallet, setPrevWallet] = useState(0)
    const [prevEndKm, setPrevEndKm] = useState<number | null>(null)
    const [mainRecordId, setMainRecordId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [mainMsg, setMainMsg] = useState('')

    // Side hustle form
    const [sideCategory, setSideCategory] = useState('')
    const [sideClient, setSideClient] = useState('')
    const [sideNote, setSideNote] = useState('')
    const [sideAmount, setSideAmount] = useState('')
    const [sideBankId, setSideBankId] = useState<string | null>(null)
    const [sideRecords, setSideRecords] = useState<any[]>([])
    const [editSideId, setEditSideId] = useState<string | null>(null)
    const [sideMsg, setSideMsg] = useState('')
    const [showCatModal, setShowCatModal] = useState(false)
    const [newCatName, setNewCatName] = useState('')
    const [dayExpensesTotal, setDayExpensesTotal] = useState(0)

    const today = todayStr()

    const fetchBase = useCallback(async () => {
        const [banksRes, prefsRes, catsRes, latestIncRes] = await Promise.all([
            supabase.from('banks').select('id,name,account_type,current_balance').eq('is_active', true).order('sort_order'),
            supabase.from('preferences').select('*').eq('id', 'default').single(),
            supabase.from('side_hustle_categories').select('*').order('name'),
            supabase.from('income_records').select('app, wallet_balance, date').eq('income_type', 'main').order('date', { ascending: false })
        ])

        if (banksRes.data) {
            let processedBanks = banksRes.data;
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
        if (prefsRes.data) setPrefs(prefsRes.data)
        if (catsRes.data) setSideCategories(catsRes.data)
    }, [])

    const fetchMonthRecords = useCallback(async () => {
        const first = firstDayOfMonth(selectedDate)
        const last = lastDayOfMonth(selectedDate)
        const res = await supabase.from('income_records').select('*')
            .gte('date', first).lte('date', last).order('created_at', { ascending: false })
        if (res.data) setMonthRecords(res.data)
    }, [selectedDate])

    const fetchForDate = useCallback(async () => {
        // Daily Expenses for selected date
        const expRes = await supabase.from('daily_expenses').select('amount, category').eq('date', selectedDate)
        let otherExp = 0;
        let dbFuel = 0;
        if (expRes.data) {
            otherExp = expRes.data.filter(e => e.category !== 'fuel').reduce((s, e) => s + (e.amount || 0), 0);
            const fuelRow = expRes.data.find(e => e.category === 'fuel' || e.category === 'Fuel'); // Handle lowercase or uppercase
            if (fuelRow) dbFuel = fuelRow.amount || 0;
        }
        setDayExpensesTotal(otherExp);

        // Main income for selected date
        const mainRes = await supabase.from('income_records').select('*')
            .eq('date', selectedDate).eq('income_type', 'main')
            .order('created_at', { ascending: false })
            .limit(1).maybeSingle()

        if (mainRes.data) {
            setMainRecordId(mainRes.data.id)
            setApp(mainRes.data.app || 'Uber')
            setStartKm(String(mainRes.data.start_km || ''))
            setEndKm(String(mainRes.data.end_km || ''))
            setDailyEarning(String(mainRes.data.daily_earning || ''))
            setCashOnHand(String(mainRes.data.cash_on_hand || ''))
            setWalletBalance(String(mainRes.data.wallet_balance || ''))
            setFuelExpense(String(mainRes.data.fuel_expense || dbFuel || ''))
        } else {
            setMainRecordId(null)
            setApp('Uber')
            setDailyEarning(''); setCashOnHand(''); setWalletBalance('');
            setFuelExpense(dbFuel ? String(dbFuel) : '')
            // Auto-fill start_km from yesterday's end_km
            if (prevEndKm !== null) setStartKm(String(prevEndKm))
            else setStartKm('')
            setEndKm('')
        }

        // Previous record for wallet/km
        const prevRes = await supabase.from('income_records').select('end_km,wallet_balance')
            .eq('income_type', 'main').lt('date', selectedDate).order('date', { ascending: false }).limit(1).maybeSingle()
        if (prevRes.data) {
            setPrevWallet(prevRes.data.wallet_balance || 0)
            setPrevEndKm(prevRes.data.end_km || null)
            if (!mainRes.data) setStartKm(String(prevRes.data.end_km || ''))
        } else {
            setPrevWallet(0);
            setPrevEndKm(null);
            if (!mainRes.data) setStartKm('')
        }

        // Default Bank to 'Cash on Hand'
        const cashBank = banks.find(b => b.name === 'Cash on Hand')
        if (cashBank) {
            if (!fuelBankId) setFuelBankId(cashBank.id)
            if (!sideBankId) setSideBankId(cashBank.id)
        }

        // Side hustles for selected date
        const sideRes = await supabase.from('income_records').select('*')
            .eq('date', selectedDate).eq('income_type', 'side').order('created_at')
        if (sideRes.data) setSideRecords(sideRes.data)
    }, [selectedDate, banks])

    useEffect(() => { fetchBase() }, [fetchBase])
    useEffect(() => { fetchMonthRecords() }, [fetchMonthRecords])
    useEffect(() => { fetchForDate() }, [fetchForDate])

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const d = params.get('date');
            const editId = params.get('edit_id');
            if (d && editId) {
                supabase.from('income_records').select('*').eq('id', editId).single().then(({ data }) => {
                    if (data) {
                        setSelectedDate(d);
                        if (data.income_type === 'side') {
                            setTab('Side Hustle');
                            setEditSideId(editId);
                            setSideCategory(data.category || '');
                            setSideClient(data.client || '');
                            setSideNote(data.note || '');
                            setSideAmount(String(data.amount || ''));
                            setSideBankId(data.bank_id);
                        } else {
                            setTab('Main Income');
                        }
                        window.history.replaceState(null, '', window.location.pathname);
                    }
                })
            }
        }
    }, [])

    const markedDates = new Set(monthRecords.map((r) => r.date))

    // Calculations
    const totalDist = Math.max(0, (parseFloat(endKm) || 0) - (parseFloat(startKm) || 0))
    const appEarning = parseFloat(dailyEarning) || 0
    const walletVal = parseFloat(walletBalance) || 0
    const cashVal = parseFloat(cashOnHand) || 0
    const walletChange = walletVal - prevWallet
    const actualAccounted = cashVal + walletChange
    const fuel = parseFloat(fuelExpense) || 0

    // Calculate expected cash after logged expenses
    const totalLoggedExpenses = dayExpensesTotal + fuel
    const expectedCash = appEarning - totalLoggedExpenses
    const balanceDiff = actualAccounted - expectedCash

    const netEarnings = actualAccounted - fuel
    const earningPerKm = totalDist > 0 ? actualAccounted / totalDist : 0

    const prefFuelPerKm = prefs ? (prefs.petrol_price_per_liter || 370) / Math.max(prefs.fuel_efficiency_km_per_liter || 30, 1) : 0
    const autoFuelCost = totalDist > 0 ? totalDist * prefFuelPerKm : 0
    const serviceCostPerDay = prefs ? (prefs.bike_service_cost_monthly || 3000) / 30 : 0
    const trueNetIncome = appEarning - totalLoggedExpenses - autoFuelCost - serviceCostPerDay
    const dailyTarget = prefs?.daily_income_target || 5000
    const goalProgress = Math.min(100, (trueNetIncome / dailyTarget) * 100)

    const saveMain = async () => {
        setSaving(true)
        try {
            const { data: currentPrefs } = await supabase.from('preferences').select('*').eq('id', 'default').single();

            let targetRecordId = mainRecordId;
            let oldDist = 0;
            let oldFuelAmt = 0;
            let oldCashVal = 0;
            let oldWalletVal = 0;
            let oldApp = app;

            // Strict check to prevent multiple entries for the same day
            const existingRes = await supabase.from('income_records').select('id, total_distance, fuel_expense, cash_on_hand, wallet_balance, app')
                .eq('date', selectedDate).eq('income_type', 'main').order('created_at', { ascending: false });

            if (existingRes.data && existingRes.data.length > 0) {
                const primary = existingRes.data[0];
                targetRecordId = primary.id;

                oldDist = primary.total_distance || 0;
                oldFuelAmt = primary.fuel_expense || 0;
                oldCashVal = primary.cash_on_hand || 0;
                oldWalletVal = primary.wallet_balance || 0;
                oldApp = primary.app || app;

                // Clean up any stray duplicates enforcing strict 1-record rule
                if (existingRes.data.length > 1) {
                    for (let i = 1; i < existingRes.data.length; i++) {
                        await supabase.from('income_records').delete().eq('id', existingRes.data[i].id);
                    }
                }
            }

            const row = {
                date: selectedDate,
                income_type: 'main',
                app,
                start_km: parseFloat(startKm) || null,
                end_km: parseFloat(endKm) || null,
                total_distance: totalDist,
                daily_earning: appEarning,
                cash_on_hand: cashVal,
                wallet_balance: walletVal,
                fuel_expense: fuel || null,
            }

            if (targetRecordId) {
                await supabase.from('income_records').update(row).eq('id', targetRecordId)
            } else {
                await supabase.from('income_records').insert(row)
            }

            const bankDeltas = new Map<string, number>();
            const addDelta = (id: string, amount: number) => {
                if (!id || amount === 0) return;
                bankDeltas.set(id, (bankDeltas.get(id) || 0) + amount);
            };

            // Cash on Hand sync
            const cashBank = banks.find((b) => b.name === 'Cash on Hand');
            if (cashBank) addDelta(cashBank.id, cashVal - oldCashVal);

            // App Wallet sync
            if (oldApp === app) {
                const walletBank = banks.find((b) => b.name === `${app} Wallet`);
                if (walletBank) addDelta(walletBank.id, walletVal - oldWalletVal);
            } else {
                const oldWalletBank = banks.find((b) => b.name === `${oldApp} Wallet`);
                if (oldWalletBank) addDelta(oldWalletBank.id, -oldWalletVal);
                const newWalletBank = banks.find((b) => b.name === `${app} Wallet`);
                if (newWalletBank) addDelta(newWalletBank.id, walletVal);
            }

            // Handle fuel expense sync
            const existFuel = await supabase.from('daily_expenses').select('*')
                .eq('date', selectedDate).eq('category', 'fuel')
                .order('created_at', { ascending: false }).limit(1).maybeSingle();

            if (fuel > 0 && fuelBankId) {
                if (existFuel.data) {
                    const oldAmt = existFuel.data.amount || 0;
                    const oldBankId = existFuel.data.bank_id;
                    await supabase.from('daily_expenses').update({ amount: fuel, bank_id: fuelBankId }).eq('id', existFuel.data.id);

                    if (oldBankId === fuelBankId) {
                        addDelta(fuelBankId, oldAmt - fuel);
                    } else {
                        if (oldBankId) addDelta(oldBankId, oldAmt);
                        addDelta(fuelBankId, -fuel);
                    }
                } else {
                    await supabase.from('daily_expenses').insert({ date: selectedDate, category: 'fuel', amount: fuel, bank_id: fuelBankId });
                    addDelta(fuelBankId, -fuel);
                }
            } else if (existFuel.data) {
                await supabase.from('daily_expenses').delete().eq('id', existFuel.data.id);
                if (existFuel.data.bank_id) {
                    addDelta(existFuel.data.bank_id, existFuel.data.amount || 0);
                }
            }

            // Apply all aggregated bank deltas
            for (const [id, delta] of bankDeltas.entries()) {
                if (delta !== 0) {
                    const b = banks.find(x => x.id === id);
                    if (b) {
                        await supabase.from('banks').update({ current_balance: b.current_balance + delta }).eq('id', id);
                    }
                }
            }

            // Tank Level Logic
            if (currentPrefs) {
                const fuelPrice = currentPrefs.petrol_price_per_liter || 370;
                const efficiency = Math.max(currentPrefs.fuel_efficiency_km_per_liter || 30, 1);
                const capacity = currentPrefs.fuel_tank_capacity_liters || 10.5;

                const deltaLitersBought = (fuel - oldFuelAmt) / fuelPrice;
                const deltaLitersConsumed = (totalDist - oldDist) / efficiency;

                const netLitersChange = deltaLitersBought - deltaLitersConsumed;

                if (Math.abs(netLitersChange) > 0.001) {
                    const newL = Math.max(0, Math.min(capacity, (currentPrefs.fuel_liters_current || 0) + netLitersChange));
                    await supabase.from('preferences').update({
                        fuel_liters_current: Math.round(newL * 100) / 100,
                        current_fuel_range_km: Math.round(newL * efficiency),
                    }).eq('id', 'default');
                }
            }

            setMainMsg('✅ Saved!')
            fetchMonthRecords(); fetchForDate(); fetchBase()
            setTimeout(() => setMainMsg(''), 2500)
        } finally { setSaving(false) }
    }

    const deleteMain = async () => {
        if (!mainRecordId || !confirm('Delete this income record?')) return

        const oldRec = await supabase.from('income_records').select('total_distance, fuel_expense, cash_on_hand, wallet_balance, app').eq('id', mainRecordId).maybeSingle();
        const oldDist = oldRec.data?.total_distance || 0;
        const oldFuelAmt = oldRec.data?.fuel_expense || 0;
        const oldCashVal = oldRec.data?.cash_on_hand || 0;
        const oldWalletVal = oldRec.data?.wallet_balance || 0;
        const oldApp = oldRec.data?.app || 'Uber';

        const bankDeltas = new Map<string, number>();
        const addDelta = (id: string, amount: number) => {
            if (!id || amount === 0) return;
            bankDeltas.set(id, (bankDeltas.get(id) || 0) + amount);
        };

        const cashBank = banks.find((b) => b.name === 'Cash on Hand');
        if (cashBank) addDelta(cashBank.id, -oldCashVal);

        const walletBank = banks.find((b) => b.name === `${oldApp} Wallet`);
        if (walletBank) addDelta(walletBank.id, -oldWalletVal);

        const existFuel = await supabase.from('daily_expenses').select('*')
            .eq('date', selectedDate).eq('category', 'fuel')
            .order('created_at', { ascending: false }).limit(1).maybeSingle();

        if (existFuel.data) {
            await supabase.from('daily_expenses').delete().eq('id', existFuel.data.id);
            if (existFuel.data.bank_id) {
                addDelta(existFuel.data.bank_id, existFuel.data.amount || 0);
            }
        }

        for (const [id, delta] of bankDeltas.entries()) {
            if (delta !== 0) {
                const b = banks.find(x => x.id === id);
                if (b) {
                    await supabase.from('banks').update({ current_balance: b.current_balance + delta }).eq('id', id);
                }
            }
        }

        await supabase.from('income_records').delete().eq('id', mainRecordId)

        // Restore fuel tank logic
        const { data: currentPrefs } = await supabase.from('preferences').select('*').eq('id', 'default').single();
        if (currentPrefs) {
            const fuelPrice = currentPrefs.petrol_price_per_liter || 370;
            const efficiency = Math.max(currentPrefs.fuel_efficiency_km_per_liter || 30, 1);
            const capacity = currentPrefs.fuel_tank_capacity_liters || 10.5;

            const revertedLitersBought = oldFuelAmt / fuelPrice;
            const revertedLitersConsumed = oldDist / efficiency;
            const netLitersRevert = revertedLitersConsumed - revertedLitersBought;

            if (Math.abs(netLitersRevert) > 0.001) {
                const newL = Math.max(0, Math.min(capacity, (currentPrefs.fuel_liters_current || 0) + netLitersRevert));
                await supabase.from('preferences').update({
                    fuel_liters_current: Math.round(newL * 100) / 100,
                    current_fuel_range_km: Math.round(newL * efficiency),
                }).eq('id', 'default');
            }
        }

        fetchForDate(); fetchMonthRecords(); fetchBase()
    }

    const saveSide = async () => {
        if (!sideAmount || !sideCategory) { alert('Fill category and amount'); return }
        const amt = parseFloat(sideAmount)
        const row = { date: selectedDate, income_type: 'side', side_category: sideCategory, client: sideClient, note: sideNote, amount: amt }
        if (editSideId) {
            const old = sideRecords.find((r) => r.id === editSideId)
            await supabase.from('income_records').update(row).eq('id', editSideId)
            // Reverse old bank credit, apply new
            if (sideBankId && old) {
                const bank = banks.find((b) => b.id === sideBankId)
                if (bank) await supabase.from('banks').update({ current_balance: bank.current_balance - (old.amount || 0) + amt }).eq('id', sideBankId)
            }
        } else {
            const res = await supabase.from('income_records').insert(row)
            if (sideBankId && !res.error) {
                const bank = banks.find((b) => b.id === sideBankId)
                if (bank) await supabase.from('banks').update({ current_balance: bank.current_balance + amt }).eq('id', sideBankId)
            }
        }
        setSideCategory(''); setSideClient(''); setSideNote(''); setSideAmount(''); setEditSideId(null)
        setSideMsg('✅ Saved!'); setTimeout(() => setSideMsg(''), 2500)
        fetchForDate(); fetchMonthRecords(); fetchBase()
    }

    const deleteSide = async (id: string, amt: number, bankId: string | null) => {
        if (!confirm('Delete?')) return
        await supabase.from('income_records').delete().eq('id', id)
        if (bankId) {
            const bank = banks.find((b) => b.id === bankId)
            if (bank) await supabase.from('banks').update({ current_balance: bank.current_balance - amt }).eq('id', bankId)
        }
        fetchForDate(); fetchMonthRecords(); fetchBase()
        setSideRecords(prev => prev.filter(r => r.id !== id))
    }

    const addCategory = async () => {
        if (!newCatName.trim()) return
        await supabase.from('side_hustle_categories').insert({ name: newCatName.trim() })
        setNewCatName(''); fetchBase()
    }

    const deleteCategory = async (id: string) => {
        if (!confirm('Delete category?')) return
        await supabase.from('side_hustle_categories').delete().eq('id', id)
        fetchBase()
    }

    const FUEL_CHIPS = [500, 1000, 1500]

    return (
        <div className="fade-in">
            {/* Date nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <button className="btn btn-ghost" style={{ padding: '8px 10px' }}
                    onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
                    <ChevronLeft size={16} />
                </button>
                <button onClick={() => setShowCal(!showCal)} style={{
                    flex: 1, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, padding: '10px 14px', color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 14, cursor: 'pointer'
                }}>
                    📅 {selectedDate === today ? 'Today' : selectedDate}
                </button>
                <button className="btn btn-ghost" style={{ padding: '8px 10px' }}
                    disabled={selectedDate >= today}
                    onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
                    <ChevronRight size={16} />
                </button>
            </div>

            {showCal && (
                <GlassCard style={{ marginBottom: 12 }}>
                    <MiniCalendar
                        selectedDate={selectedDate}
                        onSelect={(d) => { setSelectedDate(d); setShowCal(false) }}
                        markedDates={markedDates}
                    />
                </GlassCard>
            )}

            {/* Tabs */}
            <div className="tab-bar" style={{ marginBottom: 14 }}>
                {(['Main Income', 'Side Hustle'] as const).map((t) => (
                    <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
                ))}
            </div>

            {tab === 'Main Income' && (
                <div>
                    {/* App Toggle */}
                    <GlassCard style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, marginBottom: 12 }}>🚗 Ride App</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {(['Uber', 'PickMe'] as const).map((a) => (
                                <button key={a} onClick={() => setApp(a)} style={{
                                    flex: 1, padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 14,
                                    background: app === a ? (a === 'Uber' ? 'rgba(29,185,138,0.2)' : 'rgba(123,116,255,0.2)') : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${app === a ? (a === 'Uber' ? '#1DB98A' : '#7B74FF') : 'rgba(255,255,255,0.1)'}`,
                                    color: app === a ? (a === 'Uber' ? '#1DB98A' : '#7B74FF') : 'rgba(255,255,255,0.5)',
                                    cursor: 'pointer',
                                }}>
                                    {a === 'Uber' ? '🟢' : '🟣'} {a}
                                </button>
                            ))}
                        </div>
                    </GlassCard>

                    {/* Fields */}
                    <GlassCard style={{ marginBottom: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div className="field-group">
                                <div className="field-label">Start KM</div>
                                <input type="number" className="input-field" value={startKm} onChange={(e) => setStartKm(e.target.value)} placeholder="0" />
                            </div>
                            <div className="field-group">
                                <div className="field-label">End KM</div>
                                <input type="number" className="input-field" value={endKm} onChange={(e) => setEndKm(e.target.value)} placeholder="0" />
                            </div>
                        </div>
                        {totalDist > 0 && (
                            <div style={{ textAlign: 'center', color: '#1DB98A', fontWeight: 700, marginBottom: 12, fontSize: 13 }}>
                                📍 {totalDist.toFixed(1)} km traveled
                            </div>
                        )}
                        <div className="field-group">
                            <div className="field-label">Daily Earning (Rs.)</div>
                            <input type="number" className="input-field" value={dailyEarning} onChange={(e) => setDailyEarning(e.target.value)} placeholder="0" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div className="field-group">
                                <div className="field-label">Cash On Hand</div>
                                <input type="number" className="input-field" value={cashOnHand} onChange={(e) => setCashOnHand(e.target.value)} placeholder="0" />
                            </div>
                            <div className="field-group">
                                <div className="field-label">Wallet Balance</div>
                                <input type="number" className="input-field" value={walletBalance} onChange={(e) => setWalletBalance(e.target.value)} placeholder="0" />
                            </div>
                        </div>
                        <div className="field-group">
                            <div className="field-label">Fuel Expense (Rs.)</div>
                            <div className="chip-scroll" style={{ marginBottom: 8 }}>
                                {FUEL_CHIPS.map((v) => (
                                    <button key={v} className={`chip${fuelExpense === String(v) ? ' active' : ''}`}
                                        onClick={() => setFuelExpense(fuelExpense === String(v) ? '' : String(v))}>
                                        Rs.{v.toLocaleString()}
                                    </button>
                                ))}
                                <button className={`chip${fuelExpense && !FUEL_CHIPS.includes(parseFloat(fuelExpense)) ? ' active' : ''}`}
                                    onClick={() => setFuelExpense('')} style={{ fontStyle: 'italic' }}>Custom</button>
                            </div>
                            <input type="number" className="input-field" value={fuelExpense} onChange={(e) => setFuelExpense(e.target.value)} placeholder="0" />
                        </div>
                        {fuel > 0 && (
                            <div className="field-group">
                                <div className="field-label">Fuel Account</div>
                                <BankPicker banks={banks} selectedId={fuelBankId} onSelect={setFuelBankId} />
                            </div>
                        )}
                    </GlassCard>

                    {/* Daily Report */}
                    {(appEarning > 0 || actualAccounted > 0) && (
                        <GlassCard accentColor="#7B74FF" style={{ marginBottom: 12 }}>
                            <div style={{ fontWeight: 700, marginBottom: 10 }}>📊 Daily Report</div>
                            <ReportRow label="Distance Traveled" value={`${totalDist.toFixed(1)} km`} />
                            <ReportRow label="App Total Earning" value={fmt(appEarning)} />
                            <ReportRow label="Previous Wallet" value={fmt(prevWallet)} />
                            <ReportRow label={`Logged Expenses ${fuel > 0 || dayExpensesTotal > 0 ? '(incl. Fuel)' : ''}`} value={`-${fmt(totalLoggedExpenses)}`} color="#E8854A" />
                            <ReportRow label="" value="" divider />
                            <ReportRow
                                label={balanceDiff >= 0 ? 'Cash Tip / Extra' : 'Cash Short'}
                                value={`${balanceDiff >= 0 ? '+' : ''}${fmt(balanceDiff)}`}
                                color={balanceDiff >= 0 ? '#1DB98A' : '#E05555'}
                                bold
                            />
                            <ReportRow label="" value="" divider />
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: '4px 0' }}>
                                Expenses from Preferences
                            </div>
                            <ReportRow label="Fuel Cost (KM)" value={`-${fmt(autoFuelCost)}`} color="#E8854A" />
                            <ReportRow label="Bike Service /day" value={`-${fmt(serviceCostPerDay)}`} color="#D4A843" />
                            <ReportRow label="" value="" divider />
                            <ReportRow label="True Net Income" value={fmt(trueNetIncome)} color={trueNetIncome >= 0 ? '#1DB98A' : '#E05555'} bold />
                            <div style={{ marginTop: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>Daily Target Progress</span>
                                    <span style={{ color: '#7B74FF', fontWeight: 700 }}>{goalProgress.toFixed(0)}%</span>
                                </div>
                                <div className="progress-bar">
                                    <div className="progress-fill" style={{ width: `${goalProgress}%`, background: '#7B74FF' }} />
                                </div>
                            </div>
                            <ReportRow label="" value="" divider />
                            <ReportRow label="Earning per KM" value={`Rs.${earningPerKm.toFixed(1)}/km`} />
                            <ReportRow label="Fuel Cost per KM" value={`Rs.${prefFuelPerKm.toFixed(1)}/km`} />
                            <ReportRow label="Fuel Efficiency" value={`${prefs?.fuel_efficiency_km_per_liter || 30} km/L`} />
                        </GlassCard>
                    )}

                    {/* Save / Delete */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-primary" onClick={saveMain} disabled={saving} style={{ flex: 1 }}>
                            {saving ? 'Saving...' : mainRecordId ? 'Update' : 'Save Record'}
                        </button>
                        {mainRecordId && (
                            <button className="btn btn-red" onClick={deleteMain}>
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                    {mainMsg && <div style={{ textAlign: 'center', marginTop: 8, color: '#1DB98A', fontWeight: 600 }}>{mainMsg}</div>}
                </div>
            )}

            {tab === 'Side Hustle' && (
                <div>
                    <GlassCard style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ fontWeight: 700 }}>💼 Side Hustle</div>
                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setShowCatModal(true)}>
                                <Tag size={12} /> Manage Categories
                            </button>
                        </div>

                        <div className="field-group">
                            <div className="field-label">Category</div>
                            <div className="chip-scroll">
                                {sideCategories.map((c) => (
                                    <button key={c.id} className={`chip${sideCategory === c.name ? ' active' : ''}`}
                                        onClick={() => setSideCategory(sideCategory === c.name ? '' : c.name)}>
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="field-group">
                            <div className="field-label">Client Name</div>
                            <input type="text" className="input-field" value={sideClient} onChange={(e) => setSideClient(e.target.value)} placeholder="Client name" />
                        </div>
                        <div className="field-group">
                            <div className="field-label">Note</div>
                            <textarea className="input-field" value={sideNote} onChange={(e) => setSideNote(e.target.value)} placeholder="Note (optional)" rows={2} style={{ resize: 'none' }} />
                        </div>
                        <div className="field-group">
                            <div className="field-label">Amount (Rs.)</div>
                            <input type="number" className="input-field" value={sideAmount} onChange={(e) => setSideAmount(e.target.value)} placeholder="0" />
                        </div>
                        <div className="field-group">
                            <div className="field-label">Credit to Account</div>
                            <BankPicker banks={banks} selectedId={sideBankId} onSelect={setSideBankId} />
                        </div>
                        <button className="btn btn-green" style={{ width: '100%' }} onClick={saveSide}>
                            <Plus size={14} /> {editSideId ? 'Update Entry' : 'Add Side Income'}
                        </button>
                        {sideMsg && <div style={{ textAlign: 'center', marginTop: 8, color: '#1DB98A', fontWeight: 600 }}>{sideMsg}</div>}
                    </GlassCard>

                    {sideRecords.map((r) => (
                        <GlassCard key={r.id} accentColor="#1DB98A" style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <span className="badge" style={{ background: 'rgba(29,185,138,0.15)', color: '#1DB98A', marginBottom: 6 }}>
                                        {r.side_category}
                                    </span>
                                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{r.client || '—'}</div>
                                    {r.note && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{r.note}</div>}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 800, fontSize: 16, color: '#1DB98A' }}>{fmt(r.amount)}</div>
                                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                        <button className="btn btn-ghost" style={{ padding: '5px 8px', fontSize: 11 }}
                                            onClick={() => {
                                                setEditSideId(r.id); setSideCategory(r.side_category || '')
                                                setSideClient(r.client || ''); setSideNote(r.note || ''); setSideAmount(String(r.amount || ''))
                                            }}>
                                            <Edit2 size={12} />
                                        </button>
                                        <button className="btn btn-red" style={{ padding: '5px 8px', fontSize: 11 }}
                                            onClick={() => deleteSide(r.id, r.amount, r.bank_id)}>
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}

            {/* Category Modal */}
            {showCatModal && (
                <div className="modal-overlay" onClick={() => setShowCatModal(false)}>
                    <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-handle" />
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Manage Categories</div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            <input type="text" className="input-field" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="New category name" style={{ flex: 1 }} />
                            <button className="btn btn-primary" onClick={addCategory}><Plus size={14} /></button>
                        </div>
                        {sideCategories.map((c) => (
                            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                                <span style={{ fontWeight: 500 }}>{c.name}</span>
                                <button className="btn btn-red" style={{ padding: '5px 8px', fontSize: 11 }} onClick={() => deleteCategory(c.id)}>
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
