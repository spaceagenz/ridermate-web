'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt, todayStr, toISO, getGreeting, firstDayOfMonth, lastDayOfMonth, monthLabel } from '@/lib/utils'
import { ALLOCATION_RULES, ACCOUNT_TYPE_COLORS, ACCOUNT_TYPE_LABELS } from '@/lib/theme'
import FuelGauge from '@/components/ui/FuelGauge'
import GlassCard from '@/components/ui/GlassCard'
import BankPicker from '@/components/ui/BankPicker'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  Wallet, DollarSign, ShieldCheck, Zap,
  Wrench, TrendingUp, AlertTriangle, CheckCircle2, Activity
} from 'lucide-react'

export default function DashboardPage() {
  const [prefs, setPrefs] = useState<any>(null)
  const [banks, setBanks] = useState<any[]>([])
  const [todayIncome, setTodayIncome] = useState<any[]>([])
  const [chartTab, setChartTab] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily')
  const [chartData, setChartData] = useState<any[]>([])
  const [serviceCost, setServiceCost] = useState('')
  const [serviceBankId, setServiceBankId] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState('')

  const today = todayStr()

  const fetchData = useCallback(async () => {
    const [prefsRes, banksRes, incomeRes, latestIncRes] = await Promise.all([
      supabase.from('preferences').select('*').eq('id', 'default').single(),
      supabase.from('banks').select('id,name,account_type,current_balance').eq('is_active', true).order('sort_order'),
      supabase.from('income_records').select('start_km,end_km,daily_earning,amount,income_type').eq('date', today),
      supabase.from('income_records').select('app, wallet_balance, date').eq('income_type', 'main').order('date', { ascending: false })
    ])
    if (prefsRes.data) { setPrefs(prefsRes.data); setServiceCost(String(prefsRes.data.bike_service_cost_monthly || 3000)) }

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

    if (incomeRes.data) setTodayIncome(incomeRes.data)
  }, [today])

  const fetchChart = useCallback(async () => {
    if (chartTab === 'Daily') {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i))
        return toISO(d)
      })
      const [incRes, expRes] = await Promise.all([
        supabase.from('income_records').select('date,daily_earning,amount,income_type')
          .gte('date', days[0]).lte('date', days[6]),
        supabase.from('daily_expenses').select('date,amount')
          .gte('date', days[0]).lte('date', days[6]),
      ])
      const data = days.map((d) => {
        const inc = (incRes.data || []).filter((r: any) => r.date === d)
        const income = inc.reduce((s: number, r: any) =>
          s + (r.income_type === 'main' ? (r.daily_earning || 0) : (r.amount || 0)), 0)
        const expense = (expRes.data || []).filter((r: any) => r.date === d)
          .reduce((s: number, r: any) => s + (r.amount || 0), 0)
        const label = new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
        return { label, income, expense }
      })
      setChartData(data)
    } else if (chartTab === 'Weekly') {
      const weeks = Array.from({ length: 4 }, (_, i) => {
        const end = new Date(); end.setDate(end.getDate() - i * 7)
        const start = new Date(end); start.setDate(start.getDate() - 6)
        return { start: toISO(start), end: toISO(end), label: `W${4 - i}` }
      }).reverse()
      const [incRes, expRes] = await Promise.all([
        supabase.from('income_records').select('date,daily_earning,amount,income_type')
          .gte('date', weeks[0].start).lte('date', weeks[3].end),
        supabase.from('daily_expenses').select('date,amount')
          .gte('date', weeks[0].start).lte('date', weeks[3].end),
      ])
      const data = weeks.map((w) => {
        const income = (incRes.data || []).filter((r: any) => r.date >= w.start && r.date <= w.end)
          .reduce((s: number, r: any) => s + (r.income_type === 'main' ? (r.daily_earning || 0) : (r.amount || 0)), 0)
        const expense = (expRes.data || []).filter((r: any) => r.date >= w.start && r.date <= w.end)
          .reduce((s: number, r: any) => s + (r.amount || 0), 0)
        return { label: w.label, income, expense }
      })
      setChartData(data)
    } else {
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i))
        const str = toISO(d)
        return { first: firstDayOfMonth(str), last: lastDayOfMonth(str), label: monthLabel(str) }
      })
      const [incRes, expRes] = await Promise.all([
        supabase.from('income_records').select('date,daily_earning,amount,income_type')
          .gte('date', months[0].first).lte('date', months[5].last),
        supabase.from('daily_expenses').select('date,amount')
          .gte('date', months[0].first).lte('date', months[5].last),
      ])
      const data = months.map((m) => {
        const income = (incRes.data || []).filter((r: any) => r.date >= m.first && r.date <= m.last)
          .reduce((s: number, r: any) => s + (r.income_type === 'main' ? (r.daily_earning || 0) : (r.amount || 0)), 0)
        const expense = (expRes.data || []).filter((r: any) => r.date >= m.first && r.date <= m.last)
          .reduce((s: number, r: any) => s + (r.amount || 0), 0)
        return { label: m.label, income, expense }
      })
      setChartData(data)
    }
  }, [chartTab])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { fetchChart() }, [fetchChart])

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banks' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'preferences' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_expenses' }, () => { fetchData(); fetchChart() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'income_records' }, () => { fetchData(); fetchChart() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchData, fetchChart])

  // Derived values
  const totalBalance = banks.reduce((s, b) => s + (b.current_balance || 0), 0)
  const fuelL = prefs?.fuel_liters_current || 0
  const tankCap = prefs?.fuel_tank_capacity_liters || 10.5
  const efficiency = prefs?.fuel_efficiency_km_per_liter || 30
  const kmLeftService = prefs?.distance_to_next_service_km || 0
  const serviceIntervalKm = prefs?.bike_service_interval_km || 3000
  const petrolPrice = prefs?.petrol_price_per_liter || 370
  const riderName = prefs?.rider_name || 'Rider'

  const serviceUrgency = kmLeftService < 100 ? 'CRITICAL' : kmLeftService < 300 ? 'SOON' : 'OK'
  const serviceColor = serviceUrgency === 'CRITICAL' ? '#E05555' : serviceUrgency === 'SOON' ? '#D4A843' : '#1DB98A'

  const todayKm = Math.max(0, ...todayIncome.map((r) => (r.end_km || 0) - (r.start_km || 0)))
  const todayEarnings = todayIncome.reduce((s, r) =>
    s + (r.income_type === 'main' ? (r.daily_earning || 0) : (r.amount || 0)), 0)

  const avgDailyKm = todayKm > 0 ? todayKm : 50
  const daysLeftService = kmLeftService > 0 ? Math.round(kmLeftService / avgDailyKm) : 0
  const nextServiceDate = new Date(); nextServiceDate.setDate(nextServiceDate.getDate() + daysLeftService)
  const nextServiceStr = nextServiceDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const serviceProgressPct = serviceIntervalKm > 0
    ? Math.min(100, ((serviceIntervalKm - kmLeftService) / serviceIntervalKm) * 100)
    : 0
  const serviceBarColor = serviceProgressPct > 85 ? '#E05555' : serviceProgressPct > 60 ? '#D4A843' : '#1DB98A'

  const getAccountIcon = (type: string) => {
    if (type === 'cash') return '💵'
    if (type === 'wallet') return '👝'
    if (type === 'savings') return '💾'
    if (type === 'liability') return '💳'
    return '🏢'
  }

  const handleLogService = async () => {
    const cost = parseFloat(serviceCost)
    if (!cost || !serviceBankId) { alert('Enter cost and select bank'); return }
    if (!confirm(`Log bike service for ${fmt(cost)}?`)) return
    const bank = banks.find((b) => b.id === serviceBankId)
    if (!bank) return
    await Promise.all([
      supabase.from('daily_expenses').insert({ date: today, category: 'Bike Service', amount: cost, bank_id: serviceBankId }),
      supabase.from('banks').update({ current_balance: bank.current_balance - cost }).eq('id', serviceBankId),
      supabase.from('preferences').update({ distance_to_next_service_km: serviceIntervalKm }).eq('id', 'default'),
    ])
    setSaveMsg('✅ Service logged!')
    setTimeout(() => setSaveMsg(''), 2500)
    fetchData()
  }

  if (!prefs) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'rgba(255,255,255,0.4)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="pulse" style={{ fontSize: 32, marginBottom: 8 }}>🏍️</div>
          <div>Loading Ridermate...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">

      {/* Header */}
      <GlassCard accentColor="#7B74FF" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
              {getGreeting().toUpperCase()}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{riderName} 🏍️</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {todayKm > 0 && (
                <span className="badge" style={{ background: 'rgba(29,185,138,0.15)', color: '#1DB98A' }}>
                  📍 {todayKm.toFixed(1)} km today
                </span>
              )}
              {todayEarnings > 0 && (
                <span className="badge" style={{ background: 'rgba(74,159,212,0.15)', color: '#4A9FD4' }}>
                  💰 {fmt(todayEarnings)}
                </span>
              )}
            </div>
          </div>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg, #7B74FF, #4A9FD4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, flexShrink: 0,
          }}>
            {riderName.charAt(0).toUpperCase()}
          </div>
        </div>
      </GlassCard>

      {/* Summary Chart */}
      <GlassCard style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} color="#7B74FF" />
          Income vs Expenses
        </div>
        <div className="tab-bar" style={{ marginBottom: 12 }}>
          {(['Daily', 'Weekly', 'Monthly'] as const).map((t) => (
            <button key={t} className={`tab-btn${chartTab === t ? ' active' : ''}`} onClick={() => setChartTab(t)}>{t}</button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} barGap={2}>
            <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
              formatter={(val: any) => [fmt(val), ''] as any}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
            <Bar dataKey="income" name="Income" fill="#1DB98A" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expense" name="Expenses" fill="#E05555" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </GlassCard>

      {/* All Accounts */}
      <GlassCard style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wallet size={16} color="#4A9FD4" /> Accounts
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, color: totalBalance >= 0 ? '#1DB98A' : '#E05555' }}>
            {fmt(totalBalance)}
          </div>
        </div>
        {banks.map((bank) => {
          const color = ACCOUNT_TYPE_COLORS[bank.account_type] || '#7B74FF'
          const icon = getAccountIcon(bank.account_type)
          return (
            <div key={bank.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0',
              borderBottom: '0.5px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14,
                }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{bank.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                    {ACCOUNT_TYPE_LABELS[bank.account_type] || bank.account_type}
                  </div>
                </div>
              </div>
              <div style={{
                fontWeight: 700, fontSize: 14,
                color: bank.current_balance < 0 ? '#E05555' : color,
              }}>
                {fmt(bank.current_balance)}
              </div>
            </div>
          )
        })}
      </GlassCard>

      {/* Smart Allocation */}
      {todayEarnings > 0 && (
        <GlassCard accentColor="#1DB98A" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={16} color="#1DB98A" />
            Smart Allocation — {fmt(todayEarnings)}
          </div>
          {ALLOCATION_RULES.map((rule) => {
            const amount = todayEarnings * rule.pct
            return (
              <div key={rule.label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{rule.label}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{(rule.pct * 100).toFixed(0)}%</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: rule.color }}>{fmt(amount)}</span>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${rule.pct * 100}%`, background: rule.color }} />
                </div>
              </div>
            )
          })}
        </GlassCard>
      )}

      {/* Fuel Tank */}
      <GlassCard accentColor="#E8854A" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={16} color="#E8854A" />
          Fuel Tank
        </div>
        <FuelGauge
          liters={fuelL}
          capacity={tankCap}
          efficiency={efficiency}
          pricePerLiter={petrolPrice}
        />
      </GlassCard>

      {/* Service Reminder */}
      <GlassCard accentColor={serviceColor} style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wrench size={16} color={serviceColor} /> Service Reminder
          </div>
          <span className="badge" style={{
            background: `${serviceColor}20`, color: serviceColor,
          }}>
            {serviceUrgency === 'OK' ? <CheckCircle2 size={10} style={{ display: 'inline', marginRight: 3 }} /> : <AlertTriangle size={10} style={{ display: 'inline', marginRight: 3 }} />}
            {serviceUrgency}
          </span>
        </div>

        <div className="progress-bar" style={{ height: 8, marginBottom: 8 }}>
          <div className="progress-fill" style={{ width: `${serviceProgressPct}%`, background: serviceBarColor }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>KM Remaining</div>
            <div style={{ fontWeight: 700, color: serviceColor }}>{kmLeftService.toLocaleString()} km</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Est. Next Service</div>
            <div style={{ fontWeight: 700, fontSize: 12 }}>{nextServiceStr}</div>
          </div>
        </div>

        <div className="divider" />

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Quick Service Pay
          </div>
          <div className="field-group">
            <div className="field-label">Service Cost (Rs.)</div>
            <input
              type="number"
              className="input-field"
              value={serviceCost}
              onChange={(e) => setServiceCost(e.target.value)}
            />
          </div>
          <div className="field-group">
            <div className="field-label">Pay From</div>
            <BankPicker
              banks={banks}
              selectedId={serviceBankId}
              onSelect={setServiceBankId}
            />
          </div>
          <button className="btn btn-orange" onClick={handleLogService} style={{ width: '100%' }}>
            <TrendingUp size={14} /> Log Bike Service
          </button>
          {saveMsg && <div style={{ textAlign: 'center', marginTop: 8, color: '#1DB98A', fontSize: 13, fontWeight: 600 }}>{saveMsg}</div>}
        </div>
      </GlassCard>

    </div>
  )
}
