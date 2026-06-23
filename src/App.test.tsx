import { render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { beforeEach, describe, it, expect } from 'vitest'
import './i18n'

function setProfile(profile: Record<string, unknown>) {
  localStorage.setItem('learnerProfile', JSON.stringify(profile))
}

describe('App Smoke Test', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, '', '/')
  })

  it('renders without crashing', () => {
    render(<App />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the family route instead of redirecting home', async () => {
    setProfile({ onboarded: true, autoStartTodayRoutine: false })
    window.history.pushState({}, '', '/family')

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '보호자 리포트' }, { timeout: 10000 })
    ).toBeInTheDocument()
  })
})

describe('LaunchGate routing (SP-07)', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, '', '/')
  })

  it('auto-starts today routine: / -> /lesson when enabled and not done today', async () => {
    setProfile({ onboarded: true, autoStartTodayRoutine: true })
    render(<App />)

    await waitFor(() => {
      expect(window.location.pathname).toBe('/lesson')
    })
  })

  it('sends a brand-new learner to /onboarding first', async () => {
    // No profile => onboarded defaults to false.
    render(<App />)

    await waitFor(() => {
      expect(window.location.pathname).toBe('/onboarding')
    })
  })

  it('stays on Home when auto-start is off', () => {
    setProfile({ onboarded: true, autoStartTodayRoutine: false })
    render(<App />)

    expect(window.location.pathname).toBe('/')
    expect(
      screen.getByRole('button', { name: '오늘 루틴 시작하기' }),
    ).toBeInTheDocument()
  })
})
