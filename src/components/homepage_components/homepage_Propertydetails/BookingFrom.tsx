import { useMemo, useState } from 'react';
import emailjs from '@emailjs/browser';
import { Plus, Minus } from 'lucide-react';
import { FaAngleDown, FaAngleUp } from "react-icons/fa6";
import { emailJsConfig, getMissingEmailJsEnvKeys, isEmailJsConfigured } from '../../../utils/emailjsConfig';
import { inlinePolicySnippets } from '../../../content/terms';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { calculateNightlyPrice, inferUnitType } from '../../../utils/pricing';
import { toast } from 'react-toastify';
import { logUserAction, reportError } from '../../../lib/monitoring';
import { formatDateForDisplay, formatDateForInput, parseDate } from '../../../utils/formatting';
interface Property {
  property_name: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const indiaPhoneRegex = /^\+91[6-9]\d{9}$/;
const internationalPhoneRegex = /^\+[1-9]\d{6,14}$/;
const countryOptions = [
  { code: '+91', label: 'India (+91)' },
  { code: '+1', label: 'United States (+1)' },
  { code: '+44', label: 'United Kingdom (+44)' },
  { code: '+971', label: 'United Arab Emirates (+971)' },
];

const BookingForm = ({ propertyData }: { propertyData: Property }) => {
  const addDays = (date: Date, days: number) => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  };

  const today = useMemo(() => {
    const current = new Date();
    current.setHours(0, 0, 0, 0);
    return current;
  }, []);

  const maxBookingDate = useMemo(() => addDays(today, 180), [today]);

  const defaultCheckIn = formatDateForInput(today);
  const defaultCheckOut = formatDateForInput(addDays(today, 1));

  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [name, setName] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+91');
  const [phoneLocalNumber, setPhoneLocalNumber] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [showGuestDetails, setShowGuestDetails] = useState(false);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [pets, setPets] = useState(0);
  const [isServiceAnimal, setIsServiceAnimal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const unitType = inferUnitType({ property_name: propertyData?.property_name });
  const totalGuests = adults + children + infants;

  const minCheckoutDate = useMemo(() => {
    const parsedCheckIn = parseDate(checkIn);
    const fallback = addDays(today, 1);
    const computedMin = parsedCheckIn ? addDays(parsedCheckIn, 1) : fallback;
    return computedMin > maxBookingDate ? maxBookingDate : computedMin;
  }, [checkIn, maxBookingDate, today]);

  const validateDateSelection = (
    nextCheckInValue: string,
    nextCheckOutValue: string,
  ): { valid: boolean; message?: string } => {
    const parsedCheckIn = parseDate(nextCheckInValue);
    const parsedCheckOut = parseDate(nextCheckOutValue);

    if (!parsedCheckIn || !parsedCheckOut) {
      const message = 'Please select valid check-in and checkout dates.';
      setDateError(message);
      return { valid: false, message };
    }

    if (parsedCheckIn < today) {
      const message = 'Check-in cannot be in the past.';
      setDateError(message);
      return { valid: false, message };
    }

    if (parsedCheckIn > maxBookingDate) {
      const message = `Bookings are available up to ${formatDateForDisplay(maxBookingDate)}.`;
      setDateError(message);
      return { valid: false, message };
    }

    if (parsedCheckOut > maxBookingDate) {
      const message = `Checkout must be on or before ${formatDateForDisplay(maxBookingDate)}.`;
      setDateError(message);
      return { valid: false, message };
    }

    if (parsedCheckOut <= parsedCheckIn) {
      const message = 'Checkout must be after check-in.';
      setDateError(message);
      return { valid: false, message };
    }

    setDateError(null);
    return { valid: true };
  };

  const handleCheckInChange = (value: string) => {
    let nextCheckout = checkOut;
    const parsedCheckIn = parseDate(value);

    if (parsedCheckIn) {
      const minimumCheckout = addDays(parsedCheckIn, 1);
      const normalizedMinCheckout =
        minimumCheckout > maxBookingDate ? maxBookingDate : minimumCheckout;
      const parsedCheckout = parseDate(checkOut);

      if (!parsedCheckout || parsedCheckout <= parsedCheckIn) {
        nextCheckout = formatDateForInput(normalizedMinCheckout);
        setCheckOut(nextCheckout);
      }
    }

    setCheckIn(value);
    validateDateSelection(value, nextCheckout);
  };

  const handleCheckOutChange = (value: string) => {
    setCheckOut(value);
    validateDateSelection(checkIn, value);
  };

  const stayDates = useMemo(() => {
    const start = parseDate(checkIn);
    const end = parseDate(checkOut);
    if (!start || !end) return [];

    const nights: Date[] = [];
    const cursor = new Date(start);
    while (cursor < end) {
      nights.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    if (nights.length === 0) {
      nights.push(start);
    }

    return nights;
  }, [checkIn, checkOut]);

  const nightlyBreakdown = useMemo(
    () =>
      stayDates.map((date) =>
        calculateNightlyPrice({
          unitType,
          checkInDate: date,
          guests: totalGuests || 1,
        }),
      ),
    [stayDates, totalGuests, unitType],
  );

  const nights = nightlyBreakdown.length;
  const totalPrice = nightlyBreakdown.reduce((sum, breakdown) => sum + breakdown.finalNightlyPrice, 0);

  const sanitizeInput = (value: string) =>
    value
      .replace(/<[^>]*>/g, '') // strip HTML tags
      // eslint-disable-next-line no-control-regex -- intentional: strip control chars from input
      .replace(/[\u0000-\u001F\u007F]+/g, ' ')
      .replace(/\s+/g, ' ') // normalize whitespace
      .trim();
  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  const validateEmail = (nextEmail: string) => emailRegex.test(nextEmail);

  const validatePhone = (phone: string) =>
    indiaPhoneRegex.test(phone) || internationalPhoneRegex.test(phone);

  const handleEmailChange = (value: string, touched?: boolean) => {
    const normalizedEmail = normalizeEmail(value);
    setEmail(normalizedEmail);

    if (emailTouched || touched) {
      if (!normalizedEmail) {
        setEmailError('Email is required.');
      } else if (!validateEmail(normalizedEmail)) {
        setEmailError('Enter a valid email address.');
      } else {
        setEmailError(null);
      }
    }
  };

  const updatePhoneNumber = (countryCode: string, rawNumber: string, touched?: boolean) => {
    const sanitizedLocalNumber = rawNumber.replace(/\D/g, '');
    const combined = sanitizedLocalNumber ? `${countryCode}${sanitizedLocalNumber}` : '';

    setPhoneCountryCode(countryCode);
    setPhoneLocalNumber(sanitizedLocalNumber);
    setContactNumber(combined);

    if (phoneTouched || touched) {
      if (!combined) {
        setPhoneError('Contact number is required.');
      } else if (!validatePhone(combined)) {
        setPhoneError('Enter a valid contact number with country code.');
      } else {
        setPhoneError(null);
      }
    }
  };

  const isEmailValid = !!email && validateEmail(email);
  const isPhoneValid = !!contactNumber && validatePhone(contactNumber);
  const isNameValid = !!name.trim();
  const emailHelperText = emailError || 'Booking details and confirmations will be sent to this email.';
  const phoneHelperText =
    phoneError || 'Include your country code, e.g., +91 followed by a 10-digit mobile number.';
  const canSubmit = isNameValid && isEmailValid && isPhoneValid && termsAccepted && !isLoading;
  const handleSubmit = async () => {
    const dateValidation = validateDateSelection(checkIn, checkOut);

    if (!dateValidation.valid) {
      toast.error(dateValidation.message || 'Please select valid booking dates.');
      return;
    }

    setEmailTouched(true);
    setPhoneTouched(true);
    handleEmailChange(email, true);
    updatePhoneNumber(phoneCountryCode, phoneLocalNumber, true);

    const normalizedEmail = normalizeEmail(email);
    const isValidEmail = !!normalizedEmail && validateEmail(normalizedEmail);
    const isValidPhoneNumber = !!contactNumber && validatePhone(contactNumber);

    if (!name.trim()) {
      toast.warning('Please enter your name.');
      return;
    }

    if (!isValidEmail) {
      toast.warning('Please enter a valid email address.');
      return;
    }

    if (!isValidPhoneNumber) {
      toast.warning('Please enter a valid contact number with country code.');
      return;
    }

    if (!termsAccepted) {
      toast.info('Please review and accept the Terms & Conditions before reserving.');
      return;
    }
    if (!isEmailJsConfigured()) {
      const missingKeys = getMissingEmailJsEnvKeys().join(', ');
      reportError(new Error('EmailJS environment variables are not fully configured.'), {
        feature: 'booking-form',
        missingKeys,
      });
      toast.error('Booking is temporarily unavailable. Please contact support.');
      return;
    }

    setIsLoading(true);
    const sanitizedName = sanitizeInput(name);
    const sanitizedContactNumber = sanitizeInput(contactNumber);
    const sanitizedEmail = sanitizeInput(normalizedEmail);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const policyMessage =
      `Policies: ${origin}/policies | Cancel: ${origin}/policies#cancellation-refund-policy | Reschedule: ${origin}/policies#reschedule-date-change-policy | Terms: ${origin}/terms`;

    const sanitizedMessage = sanitizeInput(
      `New booking request for ${nights} nights from ${checkIn} to ${checkOut}. Guests: ${adults} adults, ${children} children, ${infants} infants, ${pets} pets. Total Price: ₹${totalPrice.toLocaleString()} ${policyMessage}`,
    );

    const templateParams = {
      to_email: emailJsConfig.ownerEmail,
      to_name: 'Property Owner',
      from_name: sanitizedName,
      contact_number: sanitizedContactNumber,
      from_email: sanitizedEmail,
      check_in: checkIn,
      check_out: checkOut,
      nights,
      adults,
      children,
      infants,
      pets,
      service_animal: isServiceAnimal ? 'Yes' : 'No',
      total_guests: totalGuests,
      termsAccepted,
      termsAcceptedAt: termsAcceptedAt || new Date().toISOString(),
      // total_price: `₹${totalPrice.toLocaleString()}`,
      property_name: propertyData?.property_name || 'Property',
      message: sanitizedMessage,
    };
    try {
      await emailjs.send(
        emailJsConfig.serviceId!,
        emailJsConfig.templateId!,
        templateParams,
        emailJsConfig.publicKey!
      );
      logUserAction('booking_form_submitted', { feature: 'booking-form', unitType, guests: totalGuests });
      toast.success('Booking request sent successfully! We will confirm details shortly.');
      // Optionally clear the form or keep data as is
      setName('');
      setPhoneCountryCode('+91');
      setPhoneLocalNumber('');
      setContactNumber('');
      setEmail('');
      setEmailTouched(false);
      setPhoneTouched(false);
      setEmailError(null);
      setPhoneError(null);
      setCheckIn(defaultCheckIn);
      setCheckOut(defaultCheckOut);
      setAdults(1);
      setChildren(0);
      setInfants(0);
      setPets(0);
      setIsServiceAnimal(false);
      setShowGuestDetails(false);
      setTermsAccepted(false);
      setTermsAcceptedAt(null);
      setIsLoading(false);
      // Resetting the form fields after successful submission
    } catch (error) {
      reportError(error, { feature: 'booking-form' });
      toast.error('Failed to send booking request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <Card className="w-full">
      <div className="space-y-4">
        <div className="rounded-lg bg-bg-muted border border-border-subtle p-3 text-sm text-text-muted space-y-1">
          <div className="font-semibold text-text-primary">Booking essentials</div>
          <p>{inlinePolicySnippets.guestId} <a className="underline" href="/terms#guests">Read more</a></p>
          <p>{inlinePolicySnippets.extraGuests} <a className="underline" href="/terms#guests">Details</a></p>
          <p>{inlinePolicySnippets.cancellation} <a className="underline" href="/terms#cancellations">Cancellation terms</a></p>
        </div>
        {/* Input Fields for Name, Contact Number, and Email */}
        <div className="space-y-2">
          <Input
            type="text"
            placeholder="Name"
            value={name}
            aria-required={true}
            aria-invalid={!isNameValid && !!name.trim()}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="space-y-1">
            <div className="flex gap-2">
              <Input
                as="select"
                value={phoneCountryCode}
                fullWidth={false}
                className="w-32"
                aria-label="Country code"
                onChange={(event) => updatePhoneNumber(event.target.value, phoneLocalNumber, phoneTouched)}
              >
                {countryOptions.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.label}
                  </option>
                ))}
              </Input>
              <Input
                type="tel"
                placeholder="Contact Number"
                value={phoneLocalNumber}
                aria-required={true}
                aria-invalid={!!phoneError}
                onChange={(e) => updatePhoneNumber(phoneCountryCode, e.target.value)}
                onBlur={(e) => {
                  setPhoneTouched(true);
                  updatePhoneNumber(phoneCountryCode, e.target.value, true);
                }}
              />
            </div>
            <p className={`text-xs ${phoneError ? 'text-destructive' : 'text-text-muted'}`}>{phoneHelperText}</p>
          </div>
          <div className="space-y-1">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              aria-required={true}
              aria-invalid={!!emailError}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={(e) => {
                setEmailTouched(true);
                handleEmailChange(e.target.value, true);
              }}
            />
            <p className={`text-xs ${emailError ? 'text-destructive' : 'text-text-muted'}`}>{emailHelperText}</p>
          </div>
        </div>

        {/* Check-in/Check-out */}
        <div className="border border-border-subtle rounded-lg overflow-hidden">
          <div className="flex">
            <div className="flex-1 p-3 border-r border-border-subtle">
              <div className="text-xs font-semibold text-text-primary uppercase tracking-wide mb-1">CHECK-IN</div>
              <Input
                type="date"
                value={checkIn}
                onChange={(e) => handleCheckInChange(e.target.value)}
                className="w-full"
                min={formatDateForInput(today)}
                max={formatDateForInput(maxBookingDate)}
              />
              <div className="text-xs text-text-muted mt-1">
                {formatDateForDisplay(checkIn)}
              </div>
            </div>
            <div className="flex-1 p-3">
              <div className="text-xs font-semibold text-text-primary uppercase tracking-wide mb-1">CHECKOUT</div>
              <Input
                type="date"
                value={checkOut}
                onChange={(e) => handleCheckOutChange(e.target.value)}
                className="w-full"
                min={formatDateForInput(minCheckoutDate)}
                max={formatDateForInput(maxBookingDate)}
              />
              <div className="text-xs text-text-muted mt-1">
                {formatDateForDisplay(checkOut)}
              </div>
            </div>
          </div>
          <div className="px-3 pb-3">
            {dateError ? (
              <div className="text-xs text-destructive">{dateError}</div>
            ) : (
              <div className="text-xs text-text-muted">
                You can book stays through {formatDateForDisplay(maxBookingDate)}.
              </div>
            )}
          </div>
        </div>

        {/* Guests Selector */}
        <div className="border border-border-subtle rounded-lg">
          <button
            type="button"
            onClick={() => setShowGuestDetails(!showGuestDetails)}
            className="w-full p-3 flex justify-between items-center text-left text-text-primary"
          >
            <div className='flex items-center justify-between w-full'>
              <div>
                <div className="text-xs font-semibold text-text-primary uppercase tracking-wide mb-1">GUESTS</div>
                <div className="text-sm font-medium text-text-primary">
                  {totalGuests === 0 
                    ? 'Guests' 
                    : (
                        <>
                          {adults + children > 0 && (
                            `${adults + children} guest${adults + children !== 1 ? 's' : ''}`
                          )}
                          {infants > 0 && (
                            <>
                              {adults + children > 0 && <>, </>}
                              {`${infants} infant${infants !== 1 ? 's' : ''}`}
                            </>
                          )}
                          {pets > 0 && (
                            <>
                              {(adults + children > 0 || infants > 0) && <>, </>}
                              {`${pets} pet${pets !== 1 ? 's' : ''}`}
                            </>
                          )}
                        </>
                      )
                  }
                </div>
              </div>
              <div className='transition duration-150 ease-in-out transform active:scale-95 text-text-muted px-4 py-2 rounded '>
                {showGuestDetails ? (
                  <FaAngleUp size={20} className="text-text-muted" />
                ) : (
                  <FaAngleDown size={20} className="text-text-muted" />
                )}
              </div>
            </div>
          </button>

          {showGuestDetails && (
            <div className="border-t border-border-subtle p-4 space-y-4">
              {/* Adults */}
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-text-primary">Adults</div>
                  <div className="text-sm text-text-muted">Age 13+</div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setAdults(Math.max(1, adults - 1))}
                    className="w-8 h-8 rounded-full border border-border-subtle flex items-center justify-center text-text-muted hover:border-border-strong disabled:opacity-50"
                    disabled={adults <= 1}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-8 text-center font-medium">{adults}</span>
                  <button
                    type="button"
                    onClick={() => setAdults(adults + 1)}
                    className="w-8 h-8 rounded-full border border-border-subtle flex items-center justify-center text-text-muted hover:border-border-strong"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Children */}
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-text-primary">Children</div>
                  <div className="text-sm text-text-muted">Ages 2-12</div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setChildren(Math.max(0, children - 1))}
                    className="w-8 h-8 rounded-full border border-border-subtle flex items-center justify-center text-text-muted hover:border-border-strong disabled:opacity-50"
                    disabled={children <= 0}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-8 text-center font-medium">{children}</span>
                  <button
                    type="button"
                    onClick={() => setChildren(children + 1)}
                    className="w-8 h-8 rounded-full border border-border-subtle flex items-center justify-center text-text-muted hover:border-border-strong"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Infants */}
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-text-primary">Infants</div>
                  <div className="text-sm text-text-muted">Under 2</div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setInfants(Math.max(0, infants - 1))}
                    className="w-8 h-8 rounded-full border border-border-subtle flex items-center justify-center text-text-muted hover:border-border-strong disabled:opacity-50"
                    disabled={infants <= 0}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-8 text-center font-medium">{infants}</span>
                  <button
                    type="button"
                    onClick={() => setInfants(infants + 1)}
                    className="w-8 h-8 rounded-full border border-border-subtle flex items-center justify-center text-text-muted hover:border-border-strong"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Pets */}
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-text-primary">Pets</div>
                  <button
                    type="button"
                    onClick={() => setIsServiceAnimal(!isServiceAnimal)}
                    className="text-sm text-text-muted underline hover:text-text-primary"
                  >
                    Bringing a service animal?
                  </button>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setPets(Math.max(0, pets - 1))}
                    className="w-8 h-8 rounded-full border border-border-subtle flex items-center justify-center text-text-muted hover:border-border-strong disabled:opacity-50"
                    disabled={pets <= 0}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-8 text-center font-medium">{pets}</span>
                  <button
                    type="button"
                    onClick={() => setPets(pets + 1)}
                    className="w-8 h-8 rounded-full border border-border-subtle flex items-center justify-center text-text-muted hover:border-border-strong"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="text-sm text-text-muted pt-2 border-t border-border-subtle">
                This place has a maximum of 2 guests, not including infants. If you're bringing more than 2 pets, please let your Host know.
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-bg-muted border border-border-subtle p-3 text-sm text-text-muted space-y-2">
          <div className="font-semibold text-text-primary">House rules &amp; damages</div>
          <p>{inlinePolicySnippets.houseRules} <a className="underline" href="/terms#house-rules">Rules</a></p>
          <p>{inlinePolicySnippets.damages} <a className="underline" href="/terms#damages">Damages</a></p>
        </div>

        {/* Reserve Button */}
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-disabled={!canSubmit}
          fullWidth
        >
          {isLoading ? 'Sending...' : 'Reserve'}
        </Button>

        <div className="space-y-2 text-sm text-text-muted">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-accent-primary"
              checked={termsAccepted}
              onChange={(event) => {
                setTermsAccepted(event.target.checked);
                setTermsAcceptedAt(event.target.checked ? new Date().toISOString() : null);
              }}
            />
            <span>
              I have read and agree to the <a className="underline" href="/terms">Terms &amp; Conditions</a> and understand the booking policies above.
            </span>
          </label>
          <p>{inlinePolicySnippets.paymentConsent}</p>
          <p className="text-center">You won't be charged yet</p>
        </div>
      </div>
    </Card>
  );
};

export default BookingForm;
