import { render, screen } from '@testing-library/react'
import App from './App'
import { describe, it, expect } from 'vitest'
import './i18n'

describe('App Smoke Test', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(document.body).toBeInTheDocument()
  })
})
