import '@testing-library/jest-dom'

// Mock window.crypto for jsdom
if (!window.crypto.subtle) {
  Object.defineProperty(window, 'crypto', {
    value: {
      subtle: {},
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256)
        }
        return arr
      },
    },
  })
}

// Mock @tauri-apps/api
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
  emit: vi.fn(),
}))
