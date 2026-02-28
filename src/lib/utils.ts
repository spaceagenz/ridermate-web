export const fmt = (n: number) =>
    `Rs. ${Math.round(n).toLocaleString('en-LK')}`

export const toISO = (d: Date) => d.toISOString().split('T')[0]
export const todayStr = () => toISO(new Date())

export function clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val))
}

export function getGreeting() {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
}

export function formatDate(dateStr: string) {
    const today = todayStr()
    const d = new Date(dateStr + 'T00:00:00')
    if (dateStr === today) return 'Today'
    const yest = new Date(); yest.setDate(yest.getDate() - 1)
    if (dateStr === toISO(yest)) return 'Yesterday'
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function addDays(dateStr: string, n: number) {
    const d = new Date(dateStr + 'T00:00:00')
    d.setDate(d.getDate() + n)
    return toISO(d)
}

export function firstDayOfMonth(dateStr: string) {
    return dateStr.slice(0, 7) + '-01'
}

export function lastDayOfMonth(dateStr: string) {
    const [y, m] = dateStr.split('-').map(Number)
    return toISO(new Date(y, m, 0))
}

export function monthLabel(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { month: 'short' })
}

export function calcNextDate(date: string, frequency: string) {
    const d = new Date(date + 'T00:00:00')
    switch (frequency) {
        case 'daily': d.setDate(d.getDate() + 1); break
        case 'weekly': d.setDate(d.getDate() + 7); break
        case 'monthly': d.setMonth(d.getMonth() + 1); break
        case 'yearly': d.setFullYear(d.getFullYear() + 1); break
    }
    return toISO(d)
}
