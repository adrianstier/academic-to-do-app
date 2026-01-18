/**
 * LoadingState Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import LoadingState from '@/components/todo/LoadingState';

describe('LoadingState', () => {
  it('should render loading animation', () => {
    const { container } = render(<LoadingState />);

    // Should have the main container
    expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
  });

  it('should render animated dots', () => {
    const { container } = render(<LoadingState />);

    // Should have 3 bouncing dots
    const dots = container.querySelectorAll('.animate-bounce');
    expect(dots).toHaveLength(3);
  });

  it('should have pulsing background effect', () => {
    const { container } = render(<LoadingState />);

    const pulsingElement = container.querySelector('.animate-pulse');
    expect(pulsingElement).toBeInTheDocument();
  });

  it('should render logo icon', () => {
    const { container } = render(<LoadingState />);

    // Should have SVG logo with checkmark
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should have ambient gradient orbs', () => {
    const { container } = render(<LoadingState />);

    // Should have blur elements for ambient effect
    const blurElements = container.querySelectorAll('.blur-\\[120px\\], .blur-\\[100px\\]');
    expect(blurElements.length).toBeGreaterThan(0);
  });

  it('should center content', () => {
    const { container } = render(<LoadingState />);

    const mainContainer = container.querySelector('.flex.items-center.justify-center');
    expect(mainContainer).toBeInTheDocument();
  });

  it('should have proper z-index for layering', () => {
    const { container } = render(<LoadingState />);

    const contentLayer = container.querySelector('.z-10');
    expect(contentLayer).toBeInTheDocument();
  });
});
