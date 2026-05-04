export function getMetricColor(key, value) {
  if (value == null || isNaN(value)) return 'text-slate-400'

  switch (key) {
    case 'temperature':
      if (value < 10) return 'text-blue-400'
      if (value < 20) return 'text-cyan-400'
      if (value < 30) return 'text-green-400'
      if (value < 38) return 'text-yellow-400'
      return 'text-red-400'

    case 'humidity':
      if (value < 30) return 'text-yellow-400'
      if (value < 70) return 'text-cyan-400'
      return 'text-blue-400'

    case 'air_quality':
    case 'co2':
      if (value < 50)  return 'text-green-400'
      if (value < 100) return 'text-yellow-400'
      if (value < 150) return 'text-orange-400'
      return 'text-red-400'

    case 'noise':
      if (value < 50) return 'text-green-400'
      if (value < 70) return 'text-yellow-400'
      if (value < 85) return 'text-orange-400'
      return 'text-red-400'

    case 'motion':
      if (value === 0) return 'text-slate-400'
      if (value < 10)  return 'text-green-400'
      if (value < 50)  return 'text-yellow-400'
      return 'text-red-400'

    default:
      return 'text-slate-300'
  }
}
