import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion, useMotionConfig } from '@/hooks/useReducedMotion';

describe('useReducedMotion', () => {
  let mockMatchMedia: ReturnType<typeof vi.fn>;
  let listeners: Array<(event: MediaQueryListEvent) => void>;

  beforeEach(() => {
    listeners = [];
    mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === 'change') {
          listeners.push(listener);
        }
      }),
      removeEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === 'change') {
          listeners = listeners.filter(l => l !== listener);
        }
      }),
    }));
    window.matchMedia = mockMatchMedia as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return false by default when no preference is set', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('should return true when user prefers reduced motion', () => {
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('should update when preference changes', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    // Simulate preference change
    act(() => {
      listeners.forEach(listener => {
        listener({ matches: true } as MediaQueryListEvent);
      });
    });

    expect(result.current).toBe(true);
  });

  it('should clean up event listener on unmount', () => {
    const removeEventListener = vi.fn();
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.push(listener);
      }),
      removeEventListener,
    }));

    const { unmount } = renderHook(() => useReducedMotion());
    unmount();

    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});

describe('useMotionConfig', () => {
  let mockMatchMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    window.matchMedia = mockMatchMedia as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return normal transitions when reduced motion is not preferred', () => {
    const { result } = renderHook(() => useMotionConfig());

    expect(result.current.skipAnimations).toBe(false);
    expect(result.current.fast).toEqual({ duration: 0.15, ease: [0.4, 0, 0.2, 1] });
    expect(result.current.normal).toEqual({ duration: 0.25, ease: [0.4, 0, 0.2, 1] });
    expect(result.current.slow).toEqual({ duration: 0.4, ease: [0.4, 0, 0.2, 1] });
    expect(result.current.spring).toEqual({ type: 'spring', damping: 20, stiffness: 300 });
    expect(result.current.bouncy).toEqual({ type: 'spring', damping: 12, stiffness: 150 });
  });

  it('should return instant transitions when reduced motion is preferred', () => {
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const { result } = renderHook(() => useMotionConfig());

    expect(result.current.skipAnimations).toBe(true);
    expect(result.current.fast).toEqual({ duration: 0 });
    expect(result.current.normal).toEqual({ duration: 0 });
    expect(result.current.slow).toEqual({ duration: 0 });
    expect(result.current.spring).toEqual({ duration: 0 });
    expect(result.current.bouncy).toEqual({ duration: 0 });
    expect(result.current.instant).toEqual({ duration: 0 });
  });
});
