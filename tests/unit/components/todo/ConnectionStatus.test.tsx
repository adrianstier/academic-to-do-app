/**
 * ConnectionStatus Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConnectionStatus from '@/components/todo/ConnectionStatus';

describe('ConnectionStatus', () => {
  it('should show "Live" when connected', () => {
    render(<ConnectionStatus connected={true} />);

    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('should show "Offline" when not connected', () => {
    render(<ConnectionStatus connected={false} />);

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('should have success styling when connected', () => {
    render(<ConnectionStatus connected={true} />);

    // The text is inside the styled div (not on parent wrapper)
    // Find the inner div with the status indicator by checking for the flex class
    const statusElement = screen.getByText('Live').closest('.flex');
    expect(statusElement).toHaveClass('bg-[var(--success-light)]');
    expect(statusElement).toHaveClass('text-[var(--success)]');
  });

  it('should have danger styling when not connected', () => {
    render(<ConnectionStatus connected={false} />);

    // The text is inside the styled div (not on parent wrapper)
    const statusElement = screen.getByText('Offline').closest('.flex');
    expect(statusElement).toHaveClass('bg-[var(--danger-light)]');
    expect(statusElement).toHaveClass('text-[var(--danger)]');
  });

  it('should render Wifi icon when connected', () => {
    const { container } = render(<ConnectionStatus connected={true} />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should render WifiOff icon when not connected', () => {
    const { container } = render(<ConnectionStatus connected={false} />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should be fixed positioned', () => {
    const { container } = render(<ConnectionStatus connected={true} />);

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('fixed');
    expect(wrapper).toHaveClass('bottom-4');
    expect(wrapper).toHaveClass('right-4');
  });

  it('should have high z-index', () => {
    const { container } = render(<ConnectionStatus connected={true} />);

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('z-30');
  });
});
