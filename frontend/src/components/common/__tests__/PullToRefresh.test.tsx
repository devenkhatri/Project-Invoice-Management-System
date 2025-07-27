import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import '@testing-library/jest-dom';
import PullToRefresh from '../PullToRefresh';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

// Mock haptic feedback
jest.mock('../MobileFeatures', () => ({
  useHapticFeedback: () => ({
    lightTap: jest.fn(),
    mediumTap: jest.fn(),
  }),
}));

describe('PullToRefresh', () => {
  const mockOnRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnRefresh.mockResolvedValue(undefined);
  });

  it('renders children correctly', () => {
    renderWithTheme(
      <PullToRefresh onRefresh={mockOnRefresh}>
        <div>Test Content</div>
      </PullToRefresh>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('shows pull to refresh indicator', () => {
    renderWithTheme(
      <PullToRefresh onRefresh={mockOnRefresh}>
        <div>Test Content</div>
      </PullToRefresh>
    );

    expect(screen.getByText('Pull to refresh')).toBeInTheDocument();
  });

  it('handles touch start event', () => {
    const { container } = renderWithTheme(
      <PullToRefresh onRefresh={mockOnRefresh}>
        <div>Test Content</div>
      </PullToRefresh>
    );

    const pullContainer = container.firstChild as HTMLElement;
    
    fireEvent.touchStart(pullContainer, {
      touches: [{ clientY: 100 }],
    });

    // Should not crash and component should still be rendered
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('handles touch move event', () => {
    const { container } = renderWithTheme(
      <PullToRefresh onRefresh={mockOnRefresh}>
        <div>Test Content</div>
      </PullToRefresh>
    );

    const pullContainer = container.firstChild as HTMLElement;
    
    // Start touch
    fireEvent.touchStart(pullContainer, {
      touches: [{ clientY: 100 }],
    });

    // Move touch down
    fireEvent.touchMove(pullContainer, {
      touches: [{ clientY: 200 }],
    });

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('handles touch end event', async () => {
    const { container } = renderWithTheme(
      <PullToRefresh onRefresh={mockOnRefresh} threshold={50}>
        <div>Test Content</div>
      </PullToRefresh>
    );

    const pullContainer = container.firstChild as HTMLElement;
    
    // Simulate pull gesture
    fireEvent.touchStart(pullContainer, {
      touches: [{ clientY: 100 }],
    });

    fireEvent.touchMove(pullContainer, {
      touches: [{ clientY: 200 }],
    });

    fireEvent.touchEnd(pullContainer);

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('shows custom text props', () => {
    renderWithTheme(
      <PullToRefresh
        onRefresh={mockOnRefresh}
        pullText="Custom pull text"
        releaseText="Custom release text"
        refreshingText="Custom refreshing text"
      >
        <div>Test Content</div>
      </PullToRefresh>
    );

    expect(screen.getByText('Custom pull text')).toBeInTheDocument();
  });

  it('handles disabled state', () => {
    const { container } = renderWithTheme(
      <PullToRefresh onRefresh={mockOnRefresh} disabled>
        <div>Test Content</div>
      </PullToRefresh>
    );

    const pullContainer = container.firstChild as HTMLElement;
    
    fireEvent.touchStart(pullContainer, {
      touches: [{ clientY: 100 }],
    });

    fireEvent.touchMove(pullContainer, {
      touches: [{ clientY: 200 }],
    });

    fireEvent.touchEnd(pullContainer);

    // Should not trigger refresh when disabled
    expect(mockOnRefresh).not.toHaveBeenCalled();
  });

  it('handles refresh error gracefully', async () => {
    const mockError = new Error('Refresh failed');
    mockOnRefresh.mockRejectedValue(mockError);
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { container } = renderWithTheme(
      <PullToRefresh onRefresh={mockOnRefresh} threshold={10}>
        <div>Test Content</div>
      </PullToRefresh>
    );

    const pullContainer = container.firstChild as HTMLElement;
    
    // Simulate successful pull gesture
    fireEvent.touchStart(pullContainer, {
      touches: [{ clientY: 100 }],
    });

    fireEvent.touchMove(pullContainer, {
      touches: [{ clientY: 250 }],
    });

    fireEvent.touchEnd(pullContainer);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Refresh failed:', mockError);
    });

    consoleSpy.mockRestore();
  });

  it('prevents multiple simultaneous refreshes', async () => {
    let resolveRefresh: () => void;
    const refreshPromise = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });
    mockOnRefresh.mockReturnValue(refreshPromise);

    const { container } = renderWithTheme(
      <PullToRefresh onRefresh={mockOnRefresh} threshold={10}>
        <div>Test Content</div>
      </PullToRefresh>
    );

    const pullContainer = container.firstChild as HTMLElement;
    
    // First refresh
    fireEvent.touchStart(pullContainer, {
      touches: [{ clientY: 100 }],
    });
    fireEvent.touchMove(pullContainer, {
      touches: [{ clientY: 250 }],
    });
    fireEvent.touchEnd(pullContainer);

    // Second refresh attempt while first is in progress
    fireEvent.touchStart(pullContainer, {
      touches: [{ clientY: 100 }],
    });
    fireEvent.touchMove(pullContainer, {
      touches: [{ clientY: 250 }],
    });
    fireEvent.touchEnd(pullContainer);

    // Should only call refresh once
    expect(mockOnRefresh).toHaveBeenCalledTimes(1);

    // Resolve the first refresh
    resolveRefresh!();
    await refreshPromise;
  });

  it('shows refreshing state correctly', async () => {
    let resolveRefresh: () => void;
    const refreshPromise = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });
    mockOnRefresh.mockReturnValue(refreshPromise);

    const { container } = renderWithTheme(
      <PullToRefresh onRefresh={mockOnRefresh} threshold={10}>
        <div>Test Content</div>
      </PullToRefresh>
    );

    const pullContainer = container.firstChild as HTMLElement;
    
    fireEvent.touchStart(pullContainer, {
      touches: [{ clientY: 100 }],
    });
    fireEvent.touchMove(pullContainer, {
      touches: [{ clientY: 250 }],
    });
    fireEvent.touchEnd(pullContainer);

    // Should show refreshing state
    await waitFor(() => {
      expect(screen.getByText('Refreshing...')).toBeInTheDocument();
    });

    // Resolve refresh
    resolveRefresh!();
    await refreshPromise;

    // Should return to normal state
    await waitFor(() => {
      expect(screen.getByText('Pull to refresh')).toBeInTheDocument();
    });
  });
});