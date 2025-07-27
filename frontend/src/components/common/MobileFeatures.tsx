import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Fab,
  Snackbar,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  CameraAlt as CameraIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  LocationOn as LocationIcon,
  Fingerprint as FingerprintIcon,
} from '@mui/icons-material';

// Camera capture component
interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onError?: (error: string) => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onError,
}) => {
  const [open, setOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Use back camera
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setOpen(true);
    } catch (error) {
      onError?.('Camera access denied or not available');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `receipt-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        onCapture(file);
        stopCamera();
      }
    }, 'image/jpeg', 0.8);
  };

  return (
    <>
      <IconButton onClick={startCamera} color="primary">
        <CameraIcon />
      </IconButton>

      <Dialog open={open} onClose={stopCamera} maxWidth="sm" fullWidth>
        <DialogTitle>Capture Receipt</DialogTitle>
        <DialogContent>
          <Box sx={{ position: 'relative', width: '100%', height: 300 }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: 8,
              }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={stopCamera}>Cancel</Button>
          <Button onClick={capturePhoto} variant="contained">
            Capture
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Voice input component
interface VoiceInputProps {
  onResult: (text: string) => void;
  onError?: (error: string) => void;
  language?: string;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onResult,
  onError,
  language = 'en-US',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      onError?.('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript(finalTranscript + interimTranscript);

      if (finalTranscript) {
        onResult(finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      onError?.(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [language, onResult, onError]);

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <IconButton
        onClick={isListening ? stopListening : startListening}
        color={isListening ? 'secondary' : 'primary'}
      >
        {isListening ? <MicOffIcon /> : <MicIcon />}
      </IconButton>
      {transcript && (
        <Typography variant="body2" sx={{ flex: 1 }}>
          {transcript}
        </Typography>
      )}
    </Box>
  );
};

// GPS location component
interface LocationCaptureProps {
  onLocation: (location: { latitude: number; longitude: number }) => void;
  onError?: (error: string) => void;
}

export const LocationCapture: React.FC<LocationCaptureProps> = ({
  onLocation,
  onError,
}) => {
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      onError?.('Geolocation is not supported by this browser');
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLoading(false);
      },
      (error) => {
        let errorMessage = 'Unable to retrieve location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        onError?.(errorMessage);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  return (
    <IconButton
      onClick={getCurrentLocation}
      disabled={loading}
      color="primary"
    >
      <LocationIcon />
    </IconButton>
  );
};

// Biometric authentication component
interface BiometricAuthProps {
  onSuccess: () => void;
  onError?: (error: string) => void;
}

export const BiometricAuth: React.FC<BiometricAuthProps> = ({
  onSuccess,
  onError,
}) => {
  const [loading, setLoading] = useState(false);

  const authenticate = async () => {
    if (!('credentials' in navigator)) {
      onError?.('Web Authentication API not supported');
      return;
    }

    setLoading(true);

    try {
      // Check if biometric authentication is available
      const available = await (navigator.credentials as any).get({
        publicKey: {
          challenge: new Uint8Array(32),
          allowCredentials: [],
          userVerification: 'required',
        },
      });

      if (available) {
        onSuccess();
      } else {
        onError?.('Biometric authentication failed');
      }
    } catch (error) {
      onError?.('Biometric authentication not available or failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <IconButton
      onClick={authenticate}
      disabled={loading}
      color="primary"
    >
      <FingerprintIcon />
    </IconButton>
  );
};

// PWA install prompt component
export const PWAInstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }

    setDeferredPrompt(null);
  };

  if (!showPrompt || !isMobile) {
    return null;
  }

  return (
    <Fab
      color="primary"
      sx={{
        position: 'fixed',
        bottom: 80, // Above bottom navigation
        right: 16,
        zIndex: theme.zIndex.fab,
      }}
      onClick={handleInstall}
    >
      <Typography variant="caption" sx={{ color: 'white' }}>
        Install
      </Typography>
    </Fab>
  );
};

// Notification permission component
export const NotificationPermission: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  React.useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      setShowPrompt(true);
    }
  }, []);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setShowPrompt(false);
      }
    }
  };

  return (
    <Snackbar
      open={showPrompt}
      onClose={() => setShowPrompt(false)}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        severity="info"
        action={
          <Button color="inherit" size="small" onClick={requestPermission}>
            Enable
          </Button>
        }
      >
        Enable notifications to stay updated on your projects and invoices
      </Alert>
    </Snackbar>
  );
};

// Enhanced mobile gesture support
interface TouchGestureProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPinch?: (scale: number) => void;
  onDoubleTap?: () => void;
  children: React.ReactNode;
  threshold?: number;
}

export const TouchGestureHandler: React.FC<TouchGestureProps> = ({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onPinch,
  onDoubleTap,
  children,
  threshold = 50,
}) => {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [lastTap, setLastTap] = useState<number>(0);
  const [initialDistance, setInitialDistance] = useState<number>(0);

  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      });
    } else if (e.touches.length === 2 && onPinch) {
      setInitialDistance(getTouchDistance(e.touches));
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && onPinch && initialDistance > 0) {
      const currentDistance = getTouchDistance(e.touches);
      const scale = currentDistance / initialDistance;
      onPinch(scale);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    setTouchEnd({ x: touchEndX, y: touchEndY });

    const deltaX = touchEndX - touchStart.x;
    const deltaY = touchEndY - touchStart.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Handle double tap
    const now = Date.now();
    if (now - lastTap < 300 && absDeltaX < 10 && absDeltaY < 10) {
      onDoubleTap?.();
      setLastTap(0);
      return;
    }
    setLastTap(now);

    // Handle swipes
    if (Math.max(absDeltaX, absDeltaY) > threshold) {
      if (absDeltaX > absDeltaY) {
        // Horizontal swipe
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      } else {
        // Vertical swipe
        if (deltaY > 0) {
          onSwipeDown?.();
        } else {
          onSwipeUp?.();
        }
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
    setInitialDistance(0);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'none' }}
    >
      {children}
    </div>
  );
};

// Enhanced offline indicator
export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineMessage(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <Snackbar
      open={showOfflineMessage}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ zIndex: 9999 }}
    >
      <Alert severity="warning" sx={{ width: '100%' }}>
        You're offline. Some features may be limited.
      </Alert>
    </Snackbar>
  );
};

// Screen orientation handler
export const useScreenOrientation = () => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  useEffect(() => {
    const updateOrientation = () => {
      if (screen.orientation) {
        setOrientation(screen.orientation.angle === 0 || screen.orientation.angle === 180 ? 'portrait' : 'landscape');
      } else {
        setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
      }
    };

    updateOrientation();

    if (screen.orientation) {
      screen.orientation.addEventListener('change', updateOrientation);
      return () => screen.orientation.removeEventListener('change', updateOrientation);
    } else {
      window.addEventListener('resize', updateOrientation);
      return () => window.removeEventListener('resize', updateOrientation);
    }
  }, []);

  return orientation;
};

// Haptic feedback
export const useHapticFeedback = () => {
  const vibrate = useCallback((pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  const lightTap = useCallback(() => vibrate(10), [vibrate]);
  const mediumTap = useCallback(() => vibrate(50), [vibrate]);
  const heavyTap = useCallback(() => vibrate(100), [vibrate]);
  const doubleTap = useCallback(() => vibrate([50, 50, 50]), [vibrate]);
  const errorTap = useCallback(() => vibrate([100, 50, 100]), [vibrate]);

  return {
    vibrate,
    lightTap,
    mediumTap,
    heavyTap,
    doubleTap,
    errorTap,
  };
};

// Declare global interfaces for TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
  
  interface Screen {
    orientation?: {
      angle: number;
      addEventListener: (event: string, handler: () => void) => void;
      removeEventListener: (event: string, handler: () => void) => void;
    };
  }
  
  interface Navigator {
    vibrate?: (pattern: number | number[]) => boolean;
  }
}