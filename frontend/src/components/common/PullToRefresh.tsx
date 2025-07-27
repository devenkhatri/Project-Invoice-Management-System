import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useHapticFeedback } from './MobileFeatures';
import { mobileStyles } from '../../utils/mobileTheme';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
  threshold?: number;
  maxPullDistance?: number;
  refreshingText?: string;
  pullText?: string;
  releaseText?: string;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false,
  threshold = 80,
  maxPullDistance = 120,
  refreshingText = 'Refreshing...',
  pullText = 'Pull to refresh',
  releaseText = 'Release to refresh',
}) => {
  const theme = useTheme();
  const { lightTap, mediumTap } = useHapticFeedback();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canRefresh, setCanRefresh] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);
  const lastHapticDistance = useRef(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;

    startY.current = e.touches[0].clientY;
    isDragging.current = true;
    lastHapticDistance.current = 0;
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging.current || disabled || isRefreshing) return;

    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      isDragging.current = false;
      return;
    }

    currentY.current = e.touches[0].clientY;
    const distance = Math.max(0, currentY.current - startY.current);
    
    if (distance > 0) {
      e.preventDefault();
      const adjustedDistance = Math.min(distance * 0.5, maxPullDistance);
      setPullDistance(adjustedDistance);
      
      const newCanRefresh = adjustedDistance >= threshold;
      if (newCanRefresh !== canRefresh) {
        setCanRefresh(newCanRefresh);
        if (newCanRefresh) {
          mediumTap(); // Haptic feedback when threshold is reached
        }
      }
      
      // Light haptic feedback during pull
      if (adjustedDistance > lastHapticDistance.current + 20) {
        lightTap();
        lastHapticDistance.current = adjustedDistance;
      }
    }
  }, [disabled, isRefreshing, threshold, maxPullDistance, canRefresh, lightTap, mediumTap]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current || disabled) return;

    isDragging.current = false;

    if (canRefresh && !isRefreshing) {
      setIsRefreshing(true);
      mediumTap(); // Haptic feedback on refresh start
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
      }
    }

    setPullDistance(0);
    setCanRefresh(false);
    lastHapticDistance.current = 0;
  }, [disabled, canRefresh, isRefreshing, onRefresh, mediumTap]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [disabled, isRefreshing, canRefresh]);

  const getRefreshIndicatorStyle = () => {
    const opacity = Math.min(pullDistance / threshold, 1);
    const scale = Math.min(pullDistance / threshold, 1);
    const rotation = (pullDistance / threshold) * 180;

    return {
      opacity,
      transform: `scale(${scale}) rotate(${rotation}deg)`,
      transition: isDragging.current ? 'none' : 'all 0.3s ease',
    };
  };

  const getContainerStyle = () => {
    return {
      transform: `translateY(${pullDistance}px)`,
      transition: isDragging.current ? 'none' : 'transform 0.3s ease',
    };
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        height: '100%',
        overflow: 'auto',
        position: 'relative',
        ...mobileStyles.touchScroll,
        ...mobileStyles.noSelect,
      }}
    >
      {/* Refresh indicator */}
      <Box
        sx={{
          position: 'absolute',
          top: -60,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 60,
          width: 120,
          borderRadius: 2,
          backgroundColor: theme.palette.background.paper,
          boxShadow: theme.shadows[2],
          ...getRefreshIndicatorStyle(),
        }}
      >
        {isRefreshing ? (
          <CircularProgress size={24} color="primary" />
        ) : (
          <RefreshIcon
            sx={{
              color: canRefresh ? theme.palette.primary.main : theme.palette.text.secondary,
              fontSize: 24,
              transition: 'color 0.2s ease',
            }}
          />
        )}
        <Typography
          variant="caption"
          sx={{
            mt: 0.5,
            color: canRefresh ? theme.palette.primary.main : theme.palette.text.secondary,
            fontWeight: canRefresh ? 600 : 400,
            transition: 'color 0.2s ease, font-weight 0.2s ease',
            textAlign: 'center',
          }}
        >
          {isRefreshing ? refreshingText : canRefresh ? releaseText : pullText}
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={getContainerStyle()}>
        {children}
      </Box>
    </Box>
  );
};

export default PullToRefresh;