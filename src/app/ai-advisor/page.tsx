'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import GlassCard from '@/components/ui/GlassCard'
import { Brain, Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { fmt } from '@/lib/utils'

export default function AIAdvisorPage() {
  const [loadingData, setLoadingData] = useState(true)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [planResult, setPlanResult] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [finData, setFinData] = useState<any>(null)

  const fetchFinancialData = async () => {
    setLoadingData(true)
    setErrorMsg(null)
    try {
      // 1. Fetch Preferences
      const { data: prefsData } = await supabase.from('preferences').select('*').eq('id', 'default').single()

      // 2. Fetch Banks & Balances
      const { data: banksData } = await supabase.from('banks').select('name, account_type, current_balance').eq('is_active', true)

      // 3. Fetch Active Liabilities
      const { data: liabilitiesData } = await supabase.from('liabilities').select('name, liability_type, principal_amount, monthly_payment, interest_rate, interest_method, arrears_amount').eq('is_active', true)

      // 4. Fetch This Month's Expenses
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
      const { data: expensesData } = await supabase.from('daily_expenses').select('category, amount').gte('date', startOfMonth)

      const expenseSummary = (expensesData || []).reduce((acc: any, curr) => {
        acc[curr.category] = (acc[curr.category] || 0) + curr.amount
        return acc
      }, {})

      // 5. Fetch This Month's Income
      const { data: incomeData } = await supabase.from('income_records').select('income_type, daily_earning, amount').gte('date', startOfMonth)

      const totalIncomeThisMonth = (incomeData || []).reduce((sum, curr) => {
        return sum + (curr.income_type === 'main' ? (curr.daily_earning || 0) : (curr.amount || 0))
      }, 0)

      setFinData({
        prefs: prefsData,
        banks: banksData,
        liabilities: liabilitiesData,
        expenseSummary,
        totalIncomeThisMonth
      })

    } catch (err: any) {
      console.error(err)
      setErrorMsg('Failed to load financial data from database.')
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    fetchFinancialData()
  }, [])

  const generateAIPlan = async () => {
    if (!finData) return

    setGeneratingPlan(true)
    setErrorMsg(null)
    setPlanResult(null)

    try {
      // Construct Prompt
      const prompt = `
You are an expert financial advisor for a ride-hailing driver in Sri Lanka.
Based on the following financial data, provide a highly personalized, accurate, and actionable financial management plan.

**User Profile:**
- Name: ${finData.prefs?.rider_name || 'Rider'}
- Daily Income Target: Rs. ${finData.prefs?.daily_income_target || 5000}
- Monthly Income Target: Rs. ${finData.prefs?.monthly_income_target || 100000}
- Current Month Income So Far: Rs. ${finData.totalIncomeThisMonth}

**Bank & Wallet Balances:**
${finData.banks?.map((b: any) => `- ${b.name} (${b.account_type}): Rs. ${b.current_balance}`).join('\n') || 'None'}

**Liabilities & Loans:**
${finData.liabilities?.length > 0 ? finData.liabilities.map((l: any) =>
  `- ${l.name} (${l.liability_type}): Principal Rs. ${l.principal_amount}, Monthly Pay Rs. ${l.monthly_payment}, Interest ${l.interest_rate}%, Arrears Rs. ${l.arrears_amount || 0}`
).join('\n') : 'None'}

**This Month's Expenses by Category:**
${Object.entries(finData.expenseSummary).map(([cat, amt]) => `- ${cat}: Rs. ${amt}`).join('\n') || 'None'}

**Your Task:**
1. Analyze their current financial health.
2. Suggest the best Debt Repayment Strategy (Snowball or Avalanche) based on their specific loans to help them get out of debt quickly.
3. Recommend how to allocate their daily earnings optimally (savings, fuel, loan payments, daily spend) to hit their goals.
4. Give 3 short, actionable tips to reduce expenses or increase efficiency.
5. Provide your answer in a clear, well-structured format with headings, bullet points, and bold text for emphasis.
6. The language used in response should be in simple Sinhala or English, but highly accurate.
      `

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch AI response')
      }

      setPlanResult(data.result)

    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Error communicating with AI service.')
    } finally {
      setGeneratingPlan(false)
    }
  }

  // Simple Markdown formatter for the result
  const formatMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>')
      .replace(/- (.*?)(?=\n|$)/g, '<li>$1</li>')
      .replace(/<br\/><li>/g, '<ul><li>')
      .replace(/<\/li>(?!<li>)/g, '</li></ul>')
  }

  return (
    <div className="fade-in">
      <GlassCard accentColor="#7B74FF" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(123,116,255,0.2), rgba(29,185,138,0.2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Brain size={24} color="#7B74FF" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>AI Smart Financial Plan</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
              Powered by Google Gemini 2.5 AI
            </div>
          </div>
        </div>

        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 16, lineHeight: 1.5 }}>
          Get a personalized strategy to manage your daily income, reduce expenses, and pay off your loans faster based on your actual data.
        </p>

        {loadingData ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
            <Loader2 size={16} className="spin" /> Syncing data...
          </div>
        ) : (
          <button
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #7B74FF, #4A9FD4)',
              width: '100%',
              marginTop: 20,
              opacity: generatingPlan ? 0.7 : 1,
              pointerEvents: generatingPlan ? 'none' : 'auto'
            }}
            onClick={generateAIPlan}
          >
            {generatingPlan ? (
              <><Loader2 size={18} className="spin" /> Generating Plan...</>
            ) : (
              <><Sparkles size={18} /> Generate My Custom Plan</>
            )}
          </button>
        )}
      </GlassCard>

      {errorMsg && (
        <GlassCard accentColor="#E05555" style={{ marginBottom: 16 }}>
          <div style={{ color: '#E05555', fontSize: 14, fontWeight: 600 }}>Error</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{errorMsg}</div>
        </GlassCard>
      )}

      {planResult && (
        <GlassCard accentColor="#1DB98A">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1DB98A' }}>Your Financial Strategy</div>
            <button
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              onClick={generateAIPlan}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          <div
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.85)',
              background: 'rgba(0,0,0,0.2)',
              padding: 16,
              borderRadius: 12,
              border: '1px solid rgba(29,185,138,0.2)'
            }}
            dangerouslySetInnerHTML={{ __html: formatMarkdown(planResult) }}
          />
        </GlassCard>
      )}

    </div>
  )
}
