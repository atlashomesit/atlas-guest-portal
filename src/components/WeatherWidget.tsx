import { useEffect, useState } from "react";

interface DayForecast {
  date: string;   // YYYY-MM-DD
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
}

interface Props {
  lat: number;
  lng: number;
  fromDate: string;  // YYYY-MM-DD
  toDate: string;    // YYYY-MM-DD
}

// WMO Weather interpretation codes → emoji
function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code <= 3) return "☁️";
  if (code <= 49) return "🌫️";
  if (code <= 59) return "🌦️";
  if (code <= 69) return "🌧️";
  if (code <= 79) return "🌨️";
  if (code <= 84) return "🌦️";
  if (code <= 94) return "⛈️";
  return "🌩️";
}

function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code <= 3) return "Overcast";
  if (code <= 49) return "Foggy";
  if (code <= 59) return "Drizzle";
  if (code <= 69) return "Rain";
  if (code <= 79) return "Snow";
  if (code <= 84) return "Showers";
  if (code <= 94) return "Thunderstorm";
  return "Storm";
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export default function WeatherWidget({ lat, lng, fromDate, toDate }: Props) {
  const [days, setDays] = useState<DayForecast[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      daily: "temperature_2m_max,temperature_2m_min,weathercode",
      timezone: "Asia/Kolkata",
      start_date: fromDate,
      end_date: toDate,
    });

    fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error("weather fetch failed");
        return r.json() as Promise<{
          daily: {
            time: string[];
            temperature_2m_max: number[];
            temperature_2m_min: number[];
            weathercode: number[];
          };
        }>;
      })
      .then((data) => {
        const { time, temperature_2m_max, temperature_2m_min, weathercode } = data.daily;
        setDays(
          time.slice(0, 7).map((date, i) => ({
            date,
            maxTemp: Math.round(temperature_2m_max[i]),
            minTemp: Math.round(temperature_2m_min[i]),
            weatherCode: weathercode[i],
          }))
        );
      })
      .catch(() => setFailed(true));
  }, [lat, lng, fromDate, toDate]);

  if (failed || days === null) return null;

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-3" data-testid="weather-widget">
      <h2 className="text-sm font-semibold text-text-primary">Weather at check-in</h2>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {days.map((day) => (
          <div
            key={day.date}
            className="flex flex-col items-center gap-1 min-w-[72px] rounded-xl border border-border-subtle bg-bg-page px-2 py-3 text-center flex-shrink-0"
          >
            <span className="text-2xl leading-none" title={weatherLabel(day.weatherCode)}>
              {weatherEmoji(day.weatherCode)}
            </span>
            <span className="text-xs font-medium text-text-primary mt-1">
              {Math.round(day.maxTemp)}°
            </span>
            <span className="text-xs text-text-muted">
              {Math.round(day.minTemp)}°
            </span>
            <span className="text-[10px] text-text-muted leading-tight mt-0.5 whitespace-nowrap">
              {formatDay(day.date)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-text-muted">Forecast via Open-Meteo. Conditions may change.</p>
    </div>
  );
}
