export function calcTotalInterest(
    principal: number,
    rate: number,
    method: string,
    months: number
): number {
    if (method === 'none' || method === 'interest_only' || rate === 0) return 0
    if (method === 'flat') return (principal * rate / 100) * months
    // Reducing balance EMI
    const r = rate / 100 / 12
    if (r === 0) return 0
    const totalPaid = principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1) * months
    return totalPaid - principal
}

export function calcMonthsRemaining(startDate: string, endDate: string) {
    const s = new Date(startDate)
    const e = new Date(endDate)
    return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function computeLiabilityStatus(item: any, payments: any[]) {
    const validPayments = payments
        .filter((p) => !p.is_future && p.liability_id === item.id)
        .sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
    const totalPaid = validPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0)

    const isRing = item.liability_type === 'pawning'

    if (item.interest_method === 'interest_only' || isRing) {
        let currentPrincipal = item.principal_amount || 0
        const ratePerMonth = (item.interest_rate || 0) / 100
        let totalInterestAccrued = item.arrears_amount || 0
        let totalInterestPaid = 0
        let lastDate = new Date(item.start_date || new Date())

        for (const payment of validPayments) {
            const pDate = new Date(payment.payment_date)
            const monthsPassed = (pDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
            totalInterestAccrued += currentPrincipal * ratePerMonth * monthsPassed
            lastDate = pDate
            const unpaidInterest = totalInterestAccrued - totalInterestPaid
            const interestPayment = Math.min(payment.amount, unpaidInterest > 0 ? unpaidInterest : 0)
            totalInterestPaid += interestPayment
            const principalPayment = payment.amount - interestPayment
            if (principalPayment > 0) currentPrincipal -= principalPayment
        }
        const monthsToNow = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
        totalInterestAccrued += currentPrincipal * ratePerMonth * monthsToNow

        const remaining = Math.max(0, currentPrincipal) + Math.max(0, totalInterestAccrued - totalInterestPaid)
        const progressPct = item.principal_amount > 0
            ? ((item.principal_amount - Math.max(0, currentPrincipal)) / item.principal_amount) * 100
            : 0

        return {
            remaining,
            arrears: Math.max(0, totalInterestAccrued - totalInterestPaid),
            advance: Math.max(0, item.principal_amount - currentPrincipal),
            currentPrincipal: Math.max(0, currentPrincipal),
            displayMonthly: Math.max(0, currentPrincipal * ratePerMonth),
            progressPct: Math.min(100, Math.max(0, progressPct)),
            totalPaid,
            penalty: 0,
        }
    } else {
        const monthsTotal = item.start_date && item.end_date
            ? calcMonthsRemaining(item.start_date, item.end_date)
            : 12
        const totalInterest = calcTotalInterest(
            item.principal_amount || 0,
            item.interest_rate || 0,
            item.interest_method || 'flat',
            monthsTotal
        )
        const totalLiability = (item.principal_amount || 0) + totalInterest + (item.arrears_amount || 0)

        const start = item.start_date ? new Date(item.start_date) : new Date()
        const payDay = item.payment_day || start.getDate()
        const now = new Date()
        let monthsPassed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
        if (now.getDate() < payDay) monthsPassed -= 1
        monthsPassed = Math.max(0, Math.min(monthsPassed, monthsTotal))

        const totalExpectedByNow = (item.arrears_amount || 0) + monthsPassed * (item.monthly_payment || 0)
        const arrears = Math.max(0, totalExpectedByNow - totalPaid)
        const advance = totalPaid > totalExpectedByNow ? totalPaid - totalExpectedByNow : 0

        let penalty = 0
        const isBike = item.liability_type === 'finance'
        if (isBike && arrears > 0) {
            const paidInstallments = Math.max(0, totalPaid - (item.arrears_amount || 0))
            const unpaidMonthIdx = Math.floor(paidInstallments / (item.monthly_payment || 1))
            const oldestDue = new Date(start.getFullYear(), start.getMonth() + unpaidMonthIdx, payDay)
            const daysOver = (now.getTime() - oldestDue.getTime()) / (1000 * 60 * 60 * 24)
            if (daysOver > 25) penalty = (arrears + (item.monthly_payment || 0)) * 0.05
        }

        // Days until next payment
        const nextPayDate = new Date(now.getFullYear(), now.getMonth(), payDay)
        if (nextPayDate < now) nextPayDate.setMonth(nextPayDate.getMonth() + 1)
        const daysUntilPayment = Math.ceil((nextPayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        return {
            remaining: Math.max(0, totalLiability + penalty - totalPaid),
            arrears,
            advance,
            penalty,
            displayMonthly: item.monthly_payment || 0,
            progressPct: (totalLiability + penalty) > 0
                ? Math.min(100, (totalPaid / (totalLiability + penalty)) * 100)
                : 0,
            totalPaid,
            totalLiability,
            currentPrincipal: item.principal_amount || 0,
            daysUntilPayment,
        }
    }
}
