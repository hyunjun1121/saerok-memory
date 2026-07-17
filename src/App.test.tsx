import { render, screen, waitFor } from '@testing-library/react'
import App from '@/App'
import { beforeEach, describe, it, expect } from 'vitest'
import '@/i18n'

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

describe('Default routing — no Home hub', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, '', '/')
  })

  it('redirects / to the routine start (lesson) screen', async () => {
    setProfile({ onboarded: true, autoStartTodayRoutine: false })
    render(<App />)

    await waitFor(() => {
      expect(window.location.pathname).toBe('/lesson')
    })
  })

  it('lands a brand-new learner on the routine start screen (no home)', async () => {
    // No profile — app still lands on the routine start screen.
    render(<App />)

    await waitFor(() => {
      expect(window.location.pathname).toBe('/lesson')
    })
    expect(
      await screen.findByTestId('lesson-start-screen', {}, { timeout: 10_000 }),
    ).toBeInTheDocument()
  })
})
