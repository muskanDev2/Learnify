import { useMemo, useState } from 'react';

export const REPORT_PERIOD_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_3_months', label: 'Last 3 Months' },
  { id: 'last_6_months', label: 'Last 6 Months' },
  { id: 'this_year', label: 'This Year' },
  { id: 'all_time', label: 'All Time' },
  { id: 'specific_month', label: 'Specific Month' },
];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function buildYearOptions() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear; year >= currentYear - 10; year -= 1) {
    years.push(year);
  }
  return years;
}

export default function ReportTimeFilter({ value, onChange, disabled = false }) {
  const now = new Date();
  const [month, setMonth] = useState(value.month || now.getMonth() + 1);
  const [year, setYear] = useState(value.year || now.getFullYear());

  const yearOptions = useMemo(() => buildYearOptions(), []);

  function handlePeriodChange(event) {
    const period = event.target.value;
    if (period === 'specific_month') {
      onChange({ period, month, year });
      return;
    }
    onChange({ period, month: undefined, year: undefined });
  }

  function handleMonthChange(event) {
    const nextMonth = Number(event.target.value);
    setMonth(nextMonth);
    onChange({ period: 'specific_month', month: nextMonth, year });
  }

  function handleYearChange(event) {
    const nextYear = Number(event.target.value);
    setYear(nextYear);
    onChange({ period: 'specific_month', month, year: nextYear });
  }

  return (
    <div className="reportTimeFilter">
      <label htmlFor="report-period-preset">Report period</label>
      <select
        id="report-period-preset"
        value={value.period || 'all_time'}
        onChange={handlePeriodChange}
        disabled={disabled}
      >
        {REPORT_PERIOD_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      {value.period === 'specific_month' && (
        <div className="reportTimeFilterMonthRow">
          <label htmlFor="report-period-month">Month</label>
          <select id="report-period-month" value={month} onChange={handleMonthChange} disabled={disabled}>
            {MONTH_NAMES.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
          <label htmlFor="report-period-year">Year</label>
          <select id="report-period-year" value={year} onChange={handleYearChange} disabled={disabled}>
            {yearOptions.map((optionYear) => (
              <option key={optionYear} value={optionYear}>
                {optionYear}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export function reportFilterToQueryParams(filter) {
  const params = new URLSearchParams();
  params.set('period', filter.period || 'all_time');
  if (filter.period === 'specific_month') {
    params.set('month', String(filter.month || new Date().getMonth() + 1));
    params.set('year', String(filter.year || new Date().getFullYear()));
  }
  return params;
}
