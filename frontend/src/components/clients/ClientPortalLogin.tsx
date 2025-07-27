import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Link,
  Divider,
  Container,
  Avatar,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Business as BusinessIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Login as LoginIcon
} from '@mui/icons-material';
import LoadingOverlay from '../layout/LoadingOverlay';
import { clientPortalService } from '../../services/api';
import { useApi } from '../../hooks/useApi';

interface ClientPortalLoginProps {
  onLogin: (client: any) => void;
  onForgotPassword?: () => void;
}

export const ClientPortalLogin: React.FC<ClientPortalLoginProps> = ({
  onLogin,
  onForgotPassword
}) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const { execute: login } = useApi(clientPortalService.login.bind(clientPortalService));

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setLoading(true);
      setErrors({});

      const response = await login(formData.email, formData.password);
      onLogin(response.client);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Invalid credentials')) {
          setErrors({ submit: 'Invalid email or password. Please try again.' });
        } else if (err.message.includes('Portal access not enabled')) {
          setErrors({ submit: 'Portal access is not enabled for your account. Please contact support.' });
        } else {
          setErrors({ submit: err.message });
        }
      } else {
        setErrors({ submit: 'Login failed. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e as any);
    }
  };

  if (loading) {
    return <LoadingOverlay message="Signing you in..." />;
  }

  return (
    <Container maxWidth="sm">
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        py={4}
      >
        {/* Logo/Brand */}
        <Box textAlign="center" mb={4}>
          <Avatar
            sx={{
              width: 80,
              height: 80,
              bgcolor: 'primary.main',
              mx: 'auto',
              mb: 2
            }}
          >
            <BusinessIcon sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Client Portal
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Access your projects, invoices, and communications
          </Typography>
        </Box>

        {/* Login Form */}
        <Card sx={{ width: '100%', maxWidth: 400 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" fontWeight="bold" textAlign="center" mb={3}>
              Sign In
            </Typography>

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                onKeyPress={handleKeyPress}
                error={!!errors.email}
                helperText={errors.email}
                margin="normal"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="action" />
                    </InputAdornment>
                  )
                }}
                autoComplete="email"
                autoFocus
              />

              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                onKeyPress={handleKeyPress}
                error={!!errors.password}
                helperText={errors.password}
                margin="normal"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                autoComplete="current-password"
              />

              {/* Error Alert */}
              {errors.submit && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {errors.submit}
                </Alert>
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                startIcon={<LoginIcon />}
                disabled={loading}
                sx={{ mt: 3, mb: 2 }}
              >
                Sign In
              </Button>
            </form>

            {/* Forgot Password Link */}
            {onForgotPassword && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box textAlign="center">
                  <Link
                    component="button"
                    variant="body2"
                    onClick={onForgotPassword}
                    sx={{ textDecoration: 'none' }}
                  >
                    Forgot your password?
                  </Link>
                </Box>
              </>
            )}
          </CardContent>
        </Card>

        {/* Help Text */}
        <Box textAlign="center" mt={3}>
          <Typography variant="body2" color="text.secondary">
            Need help accessing your account?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Contact your project manager or support team.
          </Typography>
        </Box>

        {/* Security Notice */}
        <Alert severity="info" sx={{ mt: 3, maxWidth: 400 }}>
          <Typography variant="body2">
            Your connection is secure and your data is protected with industry-standard encryption.
          </Typography>
        </Alert>
      </Box>
    </Container>
  );
};

export default ClientPortalLogin;