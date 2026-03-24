import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Phone, Lock, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AuthPage({ setUser }) {
  const navigate = useNavigate();
  const [step, setStep] = useState('input');
  const [contactType, setContactType] = useState('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (contactType === 'email' && !email) {
      toast.error('Please enter your email');
      return;
    }
    if (contactType === 'phone' && !phone) {
      toast.error('Please enter your phone');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/send-otp`, {
        email: contactType === 'email' ? email : null,
        phone: contactType === 'phone' ? phone : null,
      });
      
      // Build toast message based on delivery method
      const data = response.data;
      
      if (data.whatsapp_sent || data.delivery_method === 'whatsapp') {
        // OTP sent via WhatsApp - don't show OTP
        toast.success('📱 ' + data.message);
      } else if (data.otp_for_testing) {
        // Email delivery - show OTP for testing
        toast.success(data.message + ' (Test OTP: ' + data.otp_for_testing + ')');
      } else {
        // Phone delivery without WhatsApp - generic message
        toast.success(data.message);
      }
      
      setStep('verify');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      toast.error('Please enter OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/verify-otp`, {
        email: contactType === 'email' ? email : null,
        phone: contactType === 'phone' ? phone : null,
        otp,
      });
      localStorage.setItem('token', response.data.token);
      setUser(response.data.user);
      toast.success('Login successful!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div
        className="hidden lg:block lg:w-1/2 bg-cover bg-center relative"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1718220216044-006f43e3a9b1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODB8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBtaW5pbWFsaXN0JTIwb2ZmaWNlJTIwd29ya3NwYWNlfGVufDB8fHx8MTc2NzQ2ODYyN3ww&ixlib=rb-4.1.0&q=85')`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-accent/40 backdrop-blur-sm"></div>
        <div className="absolute inset-0 flex flex-col justify-center items-center text-white p-12">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl font-heading font-bold tracking-tight mb-2"
          >
            Atlas
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-lg font-medium text-white/80 mb-4"
          >
            by Lyor
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl font-medium"
          >
            Your Operations Command Center
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-sm text-white/70 mt-2"
          >
            Property • Factory • Team Execution
          </motion.p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center">
            <h2 className="text-3xl font-heading font-bold tracking-tight" data-testid="auth-heading">
              Welcome to Atlas
            </h2>
            <p className="mt-2 text-muted-foreground">
              {step === 'input' ? 'Sign in to access your workspace' : 'Enter the verification code sent to you'}
            </p>
          </div>

          <Alert className="border-primary/50 bg-primary/5">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Access is restricted to authorized team members. Contact your administrator if you need an account.
            </AlertDescription>
          </Alert>

          <div className="space-y-6">
            {step === 'input' && (
              <>
                <div className="flex gap-2">
                  <Button
                    variant={contactType === 'email' ? 'default' : 'outline'}
                    onClick={() => setContactType('email')}
                    className="flex-1"
                    data-testid="email-tab-button"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                  </Button>
                  <Button
                    variant={contactType === 'phone' ? 'default' : 'outline'}
                    onClick={() => setContactType('phone')}
                    className="flex-1"
                    data-testid="phone-tab-button"
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    WhatsApp
                  </Button>
                </div>

                {contactType === 'email' ? (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="email-input"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1234567890"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      data-testid="phone-input"
                    />
                  </div>
                )}

                <Button
                  onClick={handleSendOTP}
                  disabled={loading}
                  className="w-full"
                  data-testid="send-otp-button"
                >
                  {loading ? 'Sending...' : 'Send OTP'}
                </Button>
              </>
            )}

            {step === 'verify' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="otp">Enter OTP</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    data-testid="otp-input"
                  />
                </div>

                <Button
                  onClick={handleVerifyOTP}
                  disabled={loading}
                  className="w-full"
                  data-testid="verify-otp-button"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setStep('input')}
                  className="w-full"
                  data-testid="back-button"
                >
                  Back
                </Button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
