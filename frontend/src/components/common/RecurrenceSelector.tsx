import { useState } from 'react';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Repeat, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

export type RecurrenceType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';
export type RecurrenceEndType = 'NEVER' | 'ON_DATE' | 'AFTER_OCCURRENCES';

export interface RecurrenceConfig {
    recurrenceType: RecurrenceType;
    interval: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    monthOfYear?: number;
    endType: RecurrenceEndType;
    endDate?: Date;
    occurrenceCount?: number;
}

interface RecurrenceSelectorProps {
    value?: RecurrenceConfig | null;
    onChange: (config: RecurrenceConfig | null) => void;
}

const DAYS_OF_WEEK = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
];

export default function RecurrenceSelector({ value, onChange }: RecurrenceSelectorProps) {
    const [showConfig, setShowConfig] = useState(!!value);
    const [config, setConfig] = useState<RecurrenceConfig>(
        value || {
            recurrenceType: 'WEEKLY',
            interval: 1,
            daysOfWeek: [],
            endType: 'NEVER',
        }
    );

    const handleEnable = () => {
        setShowConfig(true);
        onChange(config);
    };

    const handleDisable = () => {
        setShowConfig(false);
        onChange(null);
    };

    const updateConfig = (updates: Partial<RecurrenceConfig>) => {
        const newConfig = { ...config, ...updates };
        setConfig(newConfig);
        if (showConfig) {
            onChange(newConfig);
        }
    };

    const toggleDayOfWeek = (day: number) => {
        const current = config.daysOfWeek || [];
        const updated = current.includes(day)
            ? current.filter((d) => d !== day)
            : [...current, day].sort((a, b) => a - b);
        updateConfig({ daysOfWeek: updated });
    };

    if (!showConfig) {
        return (
            <Button
                type="button"
                variant="outline"
                onClick={handleEnable}
                className="w-full justify-start gap-2 border-[var(--border)] bg-[var(--background)]"
            >
                <Repeat size={16} />
                Add
            </Button>
        );
    }

    return (
        <Card className="p-3 border-[var(--border)] bg-[var(--card)]">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Repeat size={18} className="text-[var(--primary)]" />
                    <Label className="font-semibold">Recurring Task</Label>
                </div>
                {/* <Button type="button" variant="ghost" size="icon" onClick={handleDisable}>
                    <X size={18} />
                </Button> */}
            </div>

            {/* Pattern Type */}
            <div className="space-y-1.5">
                <Label className="text-xs">Recurrence Pattern</Label>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <Select
                            value={config.recurrenceType}
                            onValueChange={(value: RecurrenceType) =>
                                updateConfig({ recurrenceType: value })
                            }
                        >
                            <SelectTrigger className="h-8 text-xs border-[var(--border)] bg-[var(--background)]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-[var(--border)] bg-[var(--popover)]">
                                <SelectItem value="DAILY" className="text-xs hover:bg-[var(--hover-bg)]">Daily</SelectItem>
                                <SelectItem value="WEEKLY" className="text-xs hover:bg-[var(--hover-bg)]">Weekly</SelectItem>
                                <SelectItem value="MONTHLY" className="text-xs hover:bg-[var(--hover-bg)]">Monthly</SelectItem>
                                <SelectItem value="QUARTERLY" className="text-xs hover:bg-[var(--hover-bg)]">Quarterly</SelectItem>
                                <SelectItem value="YEARLY" className="text-xs hover:bg-[var(--hover-bg)]">Yearly</SelectItem>
                                <SelectItem value="CUSTOM" className="text-xs hover:bg-[var(--hover-bg)]">Custom</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs">Every</span>
                            <Input
                                type="number"
                                min="1"
                                value={config.interval}
                                onChange={(e) => updateConfig({ interval: parseInt(e.target.value) || 1 })}
                                className="flex-1 h-8 text-xs border-[var(--border)] bg-[var(--background)]"
                            />
                            <span className="text-xs whitespace-nowrap">
                                {config.recurrenceType === 'DAILY' && 'day(s)'}
                                {config.recurrenceType === 'WEEKLY' && 'week(s)'}
                                {config.recurrenceType === 'MONTHLY' && 'month(s)'}
                                {config.recurrenceType === 'QUARTERLY' && 'quarter(s)'}
                                {config.recurrenceType === 'YEARLY' && 'year(s)'}
                                {config.recurrenceType === 'CUSTOM' && 'day(s)'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Days of Week (for WEEKLY) */}
            {config.recurrenceType === 'WEEKLY' && (
                <div className="space-y-1.5">
                    <Label className="text-xs">Repeat On</Label>
                    <div className="flex flex-wrap gap-1">
                        {DAYS_OF_WEEK.map((day) => (
                            <button
                                key={day.value}
                                type="button"
                                onClick={() => toggleDayOfWeek(day.value)}
                                className={`min-w-[36px] py-1.5 px-2 rounded text-xs font-medium transition-colors ${(config.daysOfWeek || []).includes(day.value)
                                    ? 'bg-[var(--primary)] text-white'
                                    : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)]'
                                    }`}
                            >
                                {day.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Day of Month (for MONTHLY/QUARTERLY/YEARLY) */}
            {(config.recurrenceType === 'MONTHLY' ||
                config.recurrenceType === 'QUARTERLY' ||
                config.recurrenceType === 'YEARLY') && (
                    <div className="space-y-1.5">
                        <Label className="text-xs">Day of Month</Label>
                        <Input
                            type="number"
                            min="1"
                            max="31"
                            value={config.dayOfMonth || ''}
                            onChange={(e) =>
                                updateConfig({
                                    dayOfMonth: parseInt(e.target.value) || undefined,
                                })
                            }
                            placeholder="e.g., 15"
                            className="h-8 text-xs border-[var(--border)] bg-[var(--background)]"
                        />
                    </div>
                )}

            {/* Month of Year (for YEARLY) */}
            {config.recurrenceType === 'YEARLY' && (
                <div className="space-y-1.5">
                    <Label className="text-xs">Month</Label>
                    <Select
                        value={config.monthOfYear?.toString() || ''}
                        onValueChange={(value) => updateConfig({ monthOfYear: parseInt(value) })}
                    >
                        <SelectTrigger className="h-8 text-xs border-[var(--border)] bg-[var(--background)]">
                            <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent className="border-[var(--border)] bg-[var(--popover)]">
                            <SelectItem value="1" className="text-xs hover:bg-[var(--hover-bg)]">January</SelectItem>
                            <SelectItem value="2" className="text-xs hover:bg-[var(--hover-bg)]">February</SelectItem>
                            <SelectItem value="3" className="text-xs hover:bg-[var(--hover-bg)]">March</SelectItem>
                            <SelectItem value="4" className="text-xs hover:bg-[var(--hover-bg)]">April</SelectItem>
                            <SelectItem value="5" className="text-xs hover:bg-[var(--hover-bg)]">May</SelectItem>
                            <SelectItem value="6" className="text-xs hover:bg-[var(--hover-bg)]">June</SelectItem>
                            <SelectItem value="7" className="text-xs hover:bg-[var(--hover-bg)]">July</SelectItem>
                            <SelectItem value="8" className="text-xs hover:bg-[var(--hover-bg)]">August</SelectItem>
                            <SelectItem value="9" className="text-xs hover:bg-[var(--hover-bg)]">September</SelectItem>
                            <SelectItem value="10" className="text-xs hover:bg-[var(--hover-bg)]">October</SelectItem>
                            <SelectItem value="11" className="text-xs hover:bg-[var(--hover-bg)]">November</SelectItem>
                            <SelectItem value="12" className="text-xs hover:bg-[var(--hover-bg)]">December</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* End Condition */}
            <div className="space-y-1.5">
                <Label className="text-xs">Ends</Label>
                <Select
                    value={config.endType}
                    onValueChange={(value: RecurrenceEndType) => updateConfig({ endType: value })}
                >
                    <SelectTrigger className="h-8 text-xs border-[var(--border)] bg-[var(--background)]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[var(--border)] bg-[var(--popover)]">
                        <SelectItem value="NEVER" className="text-xs hover:bg-[var(--hover-bg)]">Never</SelectItem>
                        <SelectItem value="ON_DATE" className="text-xs hover:bg-[var(--hover-bg)]">On Date</SelectItem>
                        <SelectItem value="AFTER_OCCURRENCES" className="text-xs hover:bg-[var(--hover-bg)]">After Occurrences</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* End Date */}
            {config.endType === 'ON_DATE' && (
                <div className="space-y-1.5">
                    <Label className="text-xs">End Date</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full h-8 justify-start text-left text-xs font-normal border-[var(--border)] bg-[var(--background)]"
                            >
                                <CalendarIcon className="mr-2 h-3 w-3" />
                                {config.endDate ? format(config.endDate, 'PPP') : 'Pick a date'}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-[var(--border)] bg-[var(--popover)]">
                            <Calendar
                                mode="single"
                                selected={config.endDate}
                                onSelect={(date: Date | undefined) => updateConfig({ endDate: date })}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            )}

            {/* Occurrence Count */}
            {config.endType === 'AFTER_OCCURRENCES' && (
                <div className="space-y-1.5">
                    <Label className="text-xs">Number of Occurrences</Label>
                    <Input
                        type="number"
                        min="1"
                        value={config.occurrenceCount || ''}
                        onChange={(e) =>
                            updateConfig({
                                occurrenceCount: parseInt(e.target.value) || undefined,
                            })
                        }
                        placeholder="e.g., 10"
                        className="h-8 text-xs border-[var(--border)] bg-[var(--background)]"
                    />
                </div>
            )}
        </Card>
    );
}
