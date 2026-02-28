'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt } from '@/lib/utils'
import GlassCard from '@/components/ui/GlassCard'
import { Save, User, Zap, Wrench, Target, Activity } from 'lucide-react'

export default function PreferencesPage() {
    const [prefs, setPrefs] = useState({
        rider_name: 'Rider',
        petrol_price_per_liter: 370,
        fuel_efficiency_km_per_liter: 30,
        fuel_tank_capacity_liters: 10.5,
        fuel_liters_current: 0,
        bike_service_cost_monthly: 3000,
        bike_service_interval_km: 3000,
        distance_to_next_service_km: 0,
        daily_income_target: 5000,
        monthly_income_target: 100000,
    })

    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState('')

    const fetchPrefs = useCallback(async () => {
        const { data } = await supabase.from('preferences').select('*').eq('id', 'default').single()
        if (data) {
            setPrefs({
                rider_name: data.rider_name || 'Rider',
                petrol_price_per_liter: data.petrol_price_per_liter || 370,
                fuel_efficiency_km_per_liter: data.fuel_efficiency_km_per_liter || 30,
                fuel_tank_capacity_liters: data.fuel_tank_capacity_liters || 10.5,
                fuel_liters_current: data.fuel_liters_current || 0,
                bike_service_cost_monthly: data.bike_service_cost_monthly || 3000,
                bike_service_interval_km: data.bike_service_interval_km || 3000,
                distance_to_next_service_km: data.distance_to_next_service_km || 0,
                daily_income_target: data.daily_income_target || 5000,
                monthly_income_target: data.monthly_income_target || 100000,
            })
        }
    }, [])

    useEffect(() => { fetchPrefs() }, [fetchPrefs])

    const handleChange = (key: string, value: string | number) => {
        setPrefs(prev => ({
            ...prev,
            [key]: typeof value === 'string' ? value : Number(value)
        }))
    }

    const handleNumberChange = (key: string, value: string) => {
        const num = parseFloat(value)
        setPrefs(prev => ({
            ...prev,
            [key]: isNaN(num) ? '' : num
        }))
    }

    const savePrefs = async () => {
        setSaving(true)

        const range = (prefs.fuel_liters_current || 0) * (prefs.fuel_efficiency_km_per_liter || 30)

        const updates = {
            ...prefs,
            current_fuel_range_km: Math.round(range),
            updated_at: new Date().toISOString()
        }

        // Default row
        await supabase.from('preferences').update(updates).eq('id', 'default')

        setSaving(false)
        setMsg('✅ Saved!')
        setTimeout(() => setMsg(''), 2500)
        fetchPrefs()
    }

    // Live Estimates Calculation
    const fuelPPL = prefs.petrol_price_per_liter || 370
    const fuelEff = Math.max(prefs.fuel_efficiency_km_per_liter || 30, 1)
    const currentLiters = prefs.fuel_liters_current || 0

    const fuelCostPerKm = fuelPPL / fuelEff
    const serviceCostPerDay = (prefs.bike_service_cost_monthly || 3000) / 30

    const totalDailyCost = (100 * fuelCostPerKm) + serviceCostPerDay
    const netAtTarget = (prefs.daily_income_target || 5000) - totalDailyCost

    const currentRange = currentLiters * fuelEff

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800 }}>Preferences</h1>
                <button
                    className="btn btn-primary"
                    onClick={savePrefs}
                    disabled={saving}
                    style={{ padding: '8px 16px' }}
                >
                    <Save size={16} /> {saving ? 'Saving...' : 'Save'}
                </button>
            </div>

            {msg && <div style={{ textAlign: 'center', marginBottom: 12, color: '#1DB98A', fontWeight: 600 }}>{msg}</div>}

            {/* RIDER PROFILE */}
            <GlassCard style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <User size={16} color="#7B74FF" /> Rider Profile
                </div>
                <div className="field-group" style={{ marginBottom: 0 }}>
                    <div className="field-label">Your Name</div>
                    <input
                        type="text"
                        className="input-field"
                        value={prefs.rider_name}
                        onChange={e => handleChange('rider_name', e.target.value)}
                    />
                </div>
            </GlassCard>

            {/* PETROL / FUEL */}
            <GlassCard accentColor="#E8854A" style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Zap size={16} color="#E8854A" /> Petrol / Fuel Cost
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="field-group">
                        <div className="field-label">Price per Liter (Rs.)</div>
                        <input
                            type="number"
                            className="input-field"
                            value={prefs.petrol_price_per_liter}
                            onChange={e => handleNumberChange('petrol_price_per_liter', e.target.value)}
                        />
                    </div>
                    <div className="field-group">
                        <div className="field-label">Fuel Efficiency (km/L)</div>
                        <input
                            type="number"
                            className="input-field"
                            value={prefs.fuel_efficiency_km_per_liter}
                            onChange={e => handleNumberChange('fuel_efficiency_km_per_liter', e.target.value)}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 6 }}>
                    <div className="field-group" style={{ marginBottom: 0 }}>
                        <div className="field-label">Tank Capacity (L)</div>
                        <input
                            type="number"
                            className="input-field"
                            value={prefs.fuel_tank_capacity_liters}
                            onChange={e => handleNumberChange('fuel_tank_capacity_liters', e.target.value)}
                        />
                    </div>
                    <div className="field-group" style={{ marginBottom: 0 }}>
                        <div className="field-label">Current Level (L)</div>
                        <input
                            type="number"
                            className="input-field"
                            value={prefs.fuel_liters_current}
                            onChange={e => handleNumberChange('fuel_liters_current', e.target.value)}
                        />
                    </div>
                </div>

                <div style={{ background: 'rgba(232,133,74,0.1)', border: '0.5px solid rgba(232,133,74,0.2)', borderRadius: 8, padding: 10, fontSize: 13, color: '#E8854A', textAlign: 'center', fontWeight: 600 }}>
                    Rs. {fuelCostPerKm.toFixed(2)} / km · {currentLiters.toFixed(1)}L → ~{Math.round(currentRange)} km range
                </div>
            </GlassCard>

            {/* BIKE SERVICE */}
            <GlassCard accentColor="#D4A843" style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Wrench size={16} color="#D4A843" /> Bike Service
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="field-group">
                        <div className="field-label">Monthly Cost (Rs.)</div>
                        <input
                            type="number"
                            className="input-field"
                            value={prefs.bike_service_cost_monthly}
                            onChange={e => handleNumberChange('bike_service_cost_monthly', e.target.value)}
                        />
                    </div>
                    <div className="field-group">
                        <div className="field-label">Service Interval (km)</div>
                        <input
                            type="number"
                            className="input-field"
                            value={prefs.bike_service_interval_km}
                            onChange={e => handleNumberChange('bike_service_interval_km', e.target.value)}
                        />
                    </div>
                </div>

                <div className="field-group">
                    <div className="field-label">Distance to Next Service (km)</div>
                    <input
                        type="number"
                        className="input-field"
                        value={prefs.distance_to_next_service_km}
                        onChange={e => handleNumberChange('distance_to_next_service_km', e.target.value)}
                    />
                </div>

                <div style={{ background: 'rgba(212,168,67,0.1)', border: '0.5px solid rgba(212,168,67,0.2)', borderRadius: 8, padding: 10, fontSize: 13, color: '#D4A843', textAlign: 'center', fontWeight: 600 }}>
                    Service: Rs. {serviceCostPerDay.toFixed(0)} / day · Next: ~{prefs.distance_to_next_service_km} km away
                </div>
            </GlassCard>

            {/* INCOME TARGETS */}
            <GlassCard accentColor="#1DB98A" style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Target size={16} color="#1DB98A" /> Income Targets
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 0 }}>
                    <div className="field-group" style={{ marginBottom: 0 }}>
                        <div className="field-label">Daily Target (Rs.)</div>
                        <input
                            type="number"
                            className="input-field"
                            value={prefs.daily_income_target}
                            onChange={e => handleNumberChange('daily_income_target', e.target.value)}
                        />
                    </div>
                    <div className="field-group" style={{ marginBottom: 0 }}>
                        <div className="field-label">Monthly Target (Rs.)</div>
                        <input
                            type="number"
                            className="input-field"
                            value={prefs.monthly_income_target}
                            onChange={e => handleNumberChange('monthly_income_target', e.target.value)}
                        />
                    </div>
                </div>
            </GlassCard>


            {/* SUMMARY */}
            <GlassCard accentColor="#7B74FF" style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={16} color="#7B74FF" /> Live Cost & Profit Estimate
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Auto-Fuel (assuming 100 km / day)</span>
                        <span style={{ fontWeight: 600 }}>{fmt(100 * fuelCostPerKm)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Service Reserve / day</span>
                        <span style={{ fontWeight: 600 }}>{fmt(serviceCostPerDay)}</span>
                    </div>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '8px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontWeight: 600 }}>
                        <span>Total Daily Cost Required</span>
                        <span>{fmt(totalDailyCost)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>Gross Daily Target</span>
                        <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>{fmt(prefs.daily_income_target || 5000)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <span style={{ fontWeight: 700 }}>True Net Income (at target)</span>
                        <span style={{ fontWeight: 800, color: netAtTarget >= 0 ? '#1DB98A' : '#E05555' }}>
                            {fmt(netAtTarget)}
                        </span>
                    </div>
                </div>
            </GlassCard>

        </div>
    )
}
