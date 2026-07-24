import '@testing-library/jest-dom'

// jsdom exposes media elements but its play/pause methods only emit
// "not implemented" errors. Component tests exercise visual and data fallback
// paths; the audio player's focused tests replace Audio with a controllable fake.
HTMLMediaElement.prototype.play = () => Promise.resolve()
HTMLMediaElement.prototype.pause = () => {}
