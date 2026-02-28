'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, TrendingUp, Receipt, Landmark, CreditCard, Settings } from 'lucide-react'

const NAV_ITEMS = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/income', label: 'Income', icon: TrendingUp },
    { href: '/expenses', label: 'Expenses', icon: Receipt },
    { href: '/banking', label: 'Banking', icon: Landmark },
    { href: '/liabilities', label: 'Debts', icon: CreditCard },
    { href: '/preferences', label: 'Settings', icon: Settings },
]

export default function Navbar() {
    const pathname = usePathname()

    return (
        <nav className="bottom-nav">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href
                return (
                    <Link key={href} href={href}>
                        <button className={`nav-item${active ? ' active' : ''}`}>
                            <Icon size={20} />
                            <span>{label}</span>
                        </button>
                    </Link>
                )
            })}
        </nav>
    )
}
