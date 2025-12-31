// BookingCard.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

interface BookingCardProps {
  propertyId: number;
  supportPadding?: boolean;
}

const BookingCard: React.FC<BookingCardProps> = ({ propertyId, supportPadding = false }) => {
  const navigate = useNavigate();
  
  const [paymentStatus, setPaymentStatus] = useState<{
    state: 'idle' | 'success' | 'failure';
    paymentId?: string;
    bookingId?: string;
    reason?: string;
  }>({ state: 'idle' });

  const [userEmail, setUserEmail] = useState<string>('');
  const [userPhone, setUserPhone] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);

  const handleSubmit = async () => {
    if (!userEmail || !userPhone) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!termsAccepted) {
      toast.error('Please accept the terms and conditions');
      return;
    }

    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setPaymentStatus({ 
        state: 'success',
        bookingId: 'BK' + Math.random().toString(36).substr(2, 8).toUpperCase()
      });
      
      toast.success('Booking submitted successfully!');
      // Reset form after successful submission
      setUserEmail('');
      setUserPhone('');
      setTermsAccepted(false);
    } catch (error) {
      setPaymentStatus({ 
        state: 'failure', 
        reason: 'Failed to process booking. Please try again.' 
      });
      toast.error('Failed to submit booking. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      id="booking-form" 
      className={`mx-auto w-full max-w-6xl p-6 bg-white shadow-lg rounded-2xl ${supportPadding ? 'my-8' : ''}`}
    >
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Book Your Stay</h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your email"
              required
            />
          </div>
          
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={userPhone}
              onChange={(e) => setUserPhone(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your phone number"
              required
            />
          </div>
          
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="terms"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                required
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="terms" className="font-medium text-gray-700">
                I agree to the terms and conditions
              </label>
              <p className="text-gray-500">By booking, you agree to our terms of service and privacy policy.</p>
            </div>
          </div>
          
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isLoading ? 'Processing...' : 'Book Now'}
            </button>
          </div>
          
          {paymentStatus.state === 'success' && (
            <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-lg">
              <p className="font-medium">Booking successful!</p>
              <p className="text-sm">Your booking ID: {paymentStatus.bookingId}</p>
              <p className="text-sm mt-2">We've sent a confirmation to your email.</p>
            </div>
          )}
          
          {paymentStatus.state === 'failure' && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg">
              <p className="font-medium">Booking failed</p>
              <p className="text-sm">{paymentStatus.reason || 'Please try again later.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingCard;
