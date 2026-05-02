import { dayNumber } from './rng'

const LAUNCH_DATE = '2026-04-27'

export interface AnteResult {
  cleared: boolean
  perfect: boolean // cleared with 2+ balls remaining
}

export function buildShareString(antes: AnteResult[], totalScore: number): string {
  const day = dayNumber(LAUNCH_DATE)
  const cleared = antes.filter(a => a.cleared).length
  const grid = antes
    .map(a => (!a.cleared ? '⬛' : a.perfect ? '🟪' : '🟦'))
    .join('')
  return `Plasmid Plinko · Day ${day}\n${grid}\n${cleared}/${antes.length} antes · ${totalScore.toLocaleString()} pts`
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false)
  }
  // Fallback
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    return Promise.resolve(true)
  } catch {
    return Promise.resolve(false)
  }
}
