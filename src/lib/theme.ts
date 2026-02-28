export const C = {
    bg: '#09090F',
    surface: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.07)',
    accent: '#7B74FF',
    accentGreen: '#1DB98A',
    accentOrange: '#E8854A',
    accentYellow: '#D4A843',
    accentPink: '#E05577',
    accentBlue: '#4A9FD4',
    accentRed: '#E05555',
    text: 'rgba(255,255,255,0.90)',
    muted: 'rgba(255,255,255,0.35)',
    error: '#E05555',
    card: 'rgba(255,255,255,0.04)',
}

export const EXPENSE_CATEGORIES = [
    { key: 'fuel', label: 'Fuel', color: '#E8854A', icon: '⛽' },
    { key: 'food', label: 'Food', color: '#1DB98A', icon: '🍴' },
    { key: 'maintenance', label: 'Maintenance', color: '#D4A843', icon: '🔧' },
    { key: 'parking', label: 'Parking', color: '#4A9FD4', icon: '🅿️' },
    { key: 'tolls', label: 'Tolls', color: '#7B74FF', icon: '🛣️' },
    { key: 'other', label: 'Other', color: '#E05577', icon: '📦' },
]

export const ACCOUNT_TYPE_COLORS: Record<string, string> = {
    daily_use: '#4A9FD4',
    savings: '#1DB98A',
    liability: '#E05577',
    emergency: '#E05555',
    wallet: '#E8854A',
    cash: '#D4A843',
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    daily_use: 'Daily Use',
    savings: 'Savings',
    liability: 'Liability',
    emergency: 'Emergency',
    wallet: 'Wallet',
    cash: 'Cash',
}

export const ALLOCATION_RULES = [
    { label: 'Savings', pct: 0.20, color: '#1DB98A' },
    { label: 'Fuel Reserve', pct: 0.15, color: '#E8854A' },
    { label: 'Service Reserve', pct: 0.10, color: '#D4A843' },
    { label: 'Daily Spend', pct: 0.55, color: '#4A9FD4' },
]
