import { Repeat } from 'lucide-react';

interface RecurringBadgeProps {
    className?: string;
}

export default function RecurringBadge({ className = '' }: RecurringBadgeProps) {
    return (
        <div
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium ${className}`}
        >
            <Repeat size={12} />
            <span>Recurring</span>
        </div>
    );
}
