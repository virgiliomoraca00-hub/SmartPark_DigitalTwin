import { useEffect, useState } from 'react'
import { SENSORS, getSensorColor } from '../data/sensors'

// Converte coordinate percentuali (0-100) in coordinate SVG (0-297)
const toSvg = (pct) => (pct / 100) * 297

export default function ParkMap({ sensorData, selectedSensor, onSelectSensor }) {
  const [svgContent, setSvgContent] = useState('')
  const [tooltip, setTooltip] = useState(null) // { sensor, x, y }

  useEffect(() => {
    fetch('/mappa_parco_sila.svg')
      .then(r => r.text())
      .then(text => {
        const cleaned = text
          .replace(/<\?xml[^>]*\?>/g, '')
          .replace(/width="[^"]*"/, 'width="100%"')
          .replace(/height="[^"]*"/, 'height="100%"')
        setSvgContent(cleaned)
      })
  }, [])

  return (
    <div className="relative w-full h-full bg-stone-100">
      {/* SVG mappa */}
      <div
        className="w-full h-full [&_svg]:w-full [&_svg]:h-full [&_path]:stroke-stone-800 [&_path]:fill-transparent"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />

      {/* SVG overlay marker — stesso viewBox della mappa, scala sempre insieme */}
      <svg
        viewBox="0 0 297 297"
        className="absolute inset-0 w-full h-full overflow-visible"
        style={{ pointerEvents: 'none' }}
      >
        {SENSORS.map(sensor => {
          const data = sensorData[sensor.id]
          const color = getSensorColor(data)
          const isSelected = selectedSensor?.id === sensor.id
          const hasAnomaly = data?.anomaly
          const cx = toSvg(sensor.x)
          const cy = toSvg(sensor.y)
          const r = isSelected ? 3 : 2

          return (
            <g key={sensor.id} style={{ pointerEvents: 'all', cursor: 'pointer' }}
              onClick={() => onSelectSensor(isSelected ? null : sensor)}
              onMouseEnter={() => setTooltip({ sensor, data, cx, cy })}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Anello animato anomalia */}
              {hasAnomaly && (
                <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.6">
                  <animate attributeName="r" values={`${r+2};${r+5};${r+2}`} dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Cerchio marker */}
              <circle
                cx={cx} cy={cy} r={r}
                fill={color}
                stroke={isSelected ? 'white' : '#1c1917'}
                strokeWidth={isSelected ? 1.5 : 0.8}
              />
            </g>
          )
        })}

        {/* Tooltip SVG */}
        {tooltip && (() => {
          const { sensor, data, cx, cy } = tooltip
          const label = data?.temperature != null
            ? `${sensor.name} · ${data.temperature.toFixed(1)}°C`
            : sensor.name
          const w = label.length * 6 + 16
          const tx = Math.min(cx, 297 - w / 2 - 4)
          const ty = cy - 12

          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect x={tx - w/2} y={ty - 12} width={w} height={16} rx="3"
                fill="#1e293b" stroke="#475569" strokeWidth="0.5" />
              <text x={tx} y={ty - 1} textAnchor="middle"
                fontSize="7" fill="white" fontFamily="system-ui, sans-serif">
                {label}
              </text>
            </g>
          )
        })()}
      </svg>

      {/* Legenda */}
      <div className="absolute bottom-3 left-3 bg-white/90 rounded-lg p-2 border border-stone-300 text-xs shadow">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          <span className="text-stone-600">Normale</span>
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
          <span className="text-stone-600">Attenzione</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          <span className="text-stone-600">Anomalia</span>
        </div>
      </div>
    </div>
  )
}
