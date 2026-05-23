import { render, screen } from '@testing-library/react'
import App from './App'
import { beforeEach, describe, it, expect } from 'vitest'
import './i18n'

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
    window.history.pushState({}, '', '/family')

    render(<App />)

    expect(await screen.findByRole('heading', { name: '상담 리포트' })).toBeInTheDocument()
  })
})
