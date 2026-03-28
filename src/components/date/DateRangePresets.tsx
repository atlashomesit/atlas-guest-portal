import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import {
  getNextWeekendRange,
  getNextWeekRange,
  get7NightsRange,
  get14NightsRange,
  isRangeUnavailable,
  isCurrentRange,
  type DatePresetRange,
} from '../../utils/datePresets';

interface DateRangePresetsProps {
  onPresetSelect: (startDate: Date, endDate: Date) => void;
  disabledDay?: (date: Date) => boolean;
  currentRange?: { startDate: Date | null; endDate: Date | null };
}

interface PresetDefinition {
  id: string;
  label: string;
  icon?: React.ReactNode;
  getRange: () => DatePresetRange;
}

export const DateRangePresets: React.FC<DateRangePresetsProps> = ({
  onPresetSelect,
  disabledDay,
  currentRange,
}) => {
  const presets: PresetDefinition[] = [
    {
      id: 'weekend',
      label: 'This Weekend',
      icon: <Calendar className="h-3 w-3" />,
      getRange: getNextWeekendRange,
    },
    {
      id: 'week',
      label: 'Next Week',
      icon: <Clock className="h-3 w-3" />,
      getRange: getNextWeekRange,
    },
    {
      id: '7nights',
      label: '7 Nights',
      getRange: () => get7NightsRange(),
    },
    {
      id: '14nights',
      label: '14 Nights',
      getRange: () => get14NightsRange(),
    },
  ];

  return (
    <div className="border-b border-[#1A365D]/8 bg-gradient-to-r from-[#FAFAF9] to-[#F7F7F6] px-4 py-4">
      <p className="mb-3 text-xs font-medium tracking-wide text-[#718096]" style={{letterSpacing: '0.5px'}}>Popular stays</p>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          let range: DatePresetRange;
          let isDisabled = false;
          let isActive = false;

          try {
            range = preset.getRange();
            isDisabled = isRangeUnavailable(range, disabledDay);
            isActive = isCurrentRange(range, currentRange);
          } catch {
            // If range calculation fails, disable the preset
            isDisabled = true;
            range = { start: new Date(), end: new Date() };
          }

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => !isDisabled && onPresetSelect(range.start, range.end)}
              disabled={isDisabled}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                isActive
                  ? 'border-[#D4AF37]/40 bg-gradient-to-r from-[#1A365D] to-[#2D4A7C] text-white shadow-[0_4px_6px_rgba(26,54,93,0.15)]'
                  : 'border-[#1A365D]/12 bg-white text-[#2D3748] hover:border-[#D4AF37]/30 hover:shadow-[0_2px_4px_rgba(0,0,0,0.04)] hover:-translate-y-0.5'
              } disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-[#1A365D]/12 disabled:hover:bg-white disabled:hover:translate-y-0`}
              aria-pressed={isActive}
            >
              {preset.icon && <span className="opacity-70">{preset.icon}</span>}
              <span>{preset.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DateRangePresets;

