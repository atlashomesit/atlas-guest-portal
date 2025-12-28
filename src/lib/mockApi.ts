/**
 * Mock API Service
 * Provides mock data for development when backend API is not available
 * 
 * Usage: Import and use instead of real API when IS_API_BASE_CONFIGURED is false
 */

import { addDays, format } from 'date-fns';

export interface MockBooking {
  id: string;
  listing: string;
  listingId: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  checkinDate: string;  // Alternative field name used by some components
  checkoutDate: string; // Alternative field name used by some components
  guests: number;
  status: 'confirmed' | 'pending' | 'cancelled';
  createdAt: string;
}

export interface MockProperty {
  id: number;
  name: string;
  slug: string;
  type: '1bhk' | '2bhk' | '3bhk' | 'penthouse';
  maxGuests: number;
  basePrice: number;
  available: boolean;
}

export interface MockListing {
  id: string;
  propertyId: number;
  name: string;
  type: string;
  price: number;
  available: boolean;
}

/**
 * Generate mock bookings for testing
 * Creates realistic booking data with some dates blocked
 */
export const generateMockBookings = (): MockBooking[] => {
  const today = new Date();
  
  return [
    // Property 201 - Atlas Homes Room 201
    {
      id: 'mock-booking-001',
      listing: 'Atlas201',
      listingId: '201',
      propertyId: '201',
      checkIn: format(addDays(today, 5), 'yyyy-MM-dd'),
      checkOut: format(addDays(today, 8), 'yyyy-MM-dd'),
      checkinDate: format(addDays(today, 5), 'yyyy-MM-dd'),
      checkoutDate: format(addDays(today, 8), 'yyyy-MM-dd'),
      guests: 2,
      status: 'confirmed',
      createdAt: format(addDays(today, -10), 'yyyy-MM-dd'),
    },
    {
      id: 'mock-booking-002',
      listing: 'Atlas201',
      listingId: '201',
      propertyId: '201',
      checkIn: format(addDays(today, 15), 'yyyy-MM-dd'),
      checkOut: format(addDays(today, 18), 'yyyy-MM-dd'),
      checkinDate: format(addDays(today, 15), 'yyyy-MM-dd'),
      checkoutDate: format(addDays(today, 18), 'yyyy-MM-dd'),
      guests: 3,
      status: 'confirmed',
      createdAt: format(addDays(today, -5), 'yyyy-MM-dd'),
    },
    // Property 301 - Atlas Homes Room 301
    {
      id: 'mock-booking-003',
      listing: 'Atlas301',
      listingId: '301',
      propertyId: '301',
      checkIn: format(addDays(today, 7), 'yyyy-MM-dd'),
      checkOut: format(addDays(today, 10), 'yyyy-MM-dd'),
      checkinDate: format(addDays(today, 7), 'yyyy-MM-dd'),
      checkoutDate: format(addDays(today, 10), 'yyyy-MM-dd'),
      guests: 4,
      status: 'confirmed',
      createdAt: format(addDays(today, -8), 'yyyy-MM-dd'),
    },
    // Property 501 - Atlas Homes Penthouse
    {
      id: 'mock-booking-004',
      listing: 'Atlas501_PH',
      listingId: '501',
      propertyId: '501',
      checkIn: format(addDays(today, 3), 'yyyy-MM-dd'),
      checkOut: format(addDays(today, 6), 'yyyy-MM-dd'),
      checkinDate: format(addDays(today, 3), 'yyyy-MM-dd'),
      checkoutDate: format(addDays(today, 6), 'yyyy-MM-dd'),
      guests: 2,
      status: 'confirmed',
      createdAt: format(addDays(today, -12), 'yyyy-MM-dd'),
    },
    {
      id: 'mock-booking-005',
      listing: 'Atlas501_PH',
      listingId: '501',
      propertyId: '501',
      checkIn: format(addDays(today, 20), 'yyyy-MM-dd'),
      checkOut: format(addDays(today, 25), 'yyyy-MM-dd'),
      checkinDate: format(addDays(today, 20), 'yyyy-MM-dd'),
      checkoutDate: format(addDays(today, 25), 'yyyy-MM-dd'),
      guests: 4,
      status: 'confirmed',
      createdAt: format(addDays(today, -3), 'yyyy-MM-dd'),
    },
  ];
};

/**
 * Generate mock properties for testing
 */
export const generateMockProperties = (): MockProperty[] => {
  return [
    {
      id: 201,
      name: 'Atlas Homes Room 201',
      slug: 'atlas-homes-room-201',
      type: '1bhk',
      maxGuests: 3,
      basePrice: 3500,
      available: true,
    },
    {
      id: 301,
      name: 'Atlas Homes Room 301',
      slug: 'atlas-homes-room-301',
      type: '2bhk',
      maxGuests: 4,
      basePrice: 4500,
      available: true,
    },
    {
      id: 401,
      name: 'Atlas Homes Room 401',
      slug: 'atlas-homes-room-401',
      type: '2bhk',
      maxGuests: 4,
      basePrice: 4800,
      available: true,
    },
    {
      id: 501,
      name: 'Atlas Homes Penthouse',
      slug: 'atlas-homes-penthouse',
      type: 'penthouse',
      maxGuests: 6,
      basePrice: 7000,
      available: true,
    },
  ];
};

/**
 * Generate mock listings for testing
 */
export const generateMockListings = (): MockListing[] => {
  return [
    {
      id: 'Atlas201',
      propertyId: 201,
      name: 'Atlas Homes Room 201',
      type: '1bhk',
      price: 3500,
      available: true,
    },
    {
      id: 'Atlas301',
      propertyId: 301,
      name: 'Atlas Homes Room 301',
      type: '2bhk',
      price: 4500,
      available: true,
    },
    {
      id: 'Atlas401',
      propertyId: 401,
      name: 'Atlas Homes Room 401',
      type: '2bhk',
      price: 4800,
      available: true,
    },
    {
      id: 'Atlas501_PH',
      propertyId: 501,
      name: 'Atlas Homes Penthouse',
      type: 'penthouse',
      price: 7000,
      available: true,
    },
  ];
};

/**
 * Mock API client that returns mock data
 */
export const mockApi = {
  get: async <T = unknown>(path: string): Promise<{ data: T; status: number }> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.log('🎭 [MOCK API] GET request to:', path);
    
    if (path === '/bookings' || path.includes('/bookings')) {
      const bookings = generateMockBookings();
      console.log('🎭 [MOCK API] Returning', bookings.length, 'mock bookings');
      return {
        data: { bookings } as T,
        status: 200,
      };
    }
    
    if (path === '/properties' || path.includes('/properties')) {
      const properties = generateMockProperties();
      console.log('🎭 [MOCK API] Returning', properties.length, 'mock properties');
      return {
        data: properties as T,
        status: 200,
      };
    }
    
    if (path === '/listings' || path.includes('/listings')) {
      const listings = generateMockListings();
      console.log('🎭 [MOCK API] Returning', listings.length, 'mock listings');
      return {
        data: listings as T,
        status: 200,
      };
    }
    
    console.warn('🎭 [MOCK API] Unknown endpoint:', path);
    return {
      data: {} as T,
      status: 404,
    };
  },
  
  post: async <T = unknown>(path: string, body?: unknown): Promise<{ data: T; status: number }> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('🎭 [MOCK API] POST request to:', path, 'with body:', body);
    
    // Mock successful response
    return {
      data: { success: true, message: 'Mock API response' } as T,
      status: 200,
    };
  },
};

/**
 * Check if we should use mock API
 */
export const shouldUseMockApi = (): boolean => {
  const envMode = import.meta.env.MODE || 'development';
  const isDev = envMode === 'development';
  
  // Use mock API in development when API_BASE_URL is not configured
  return isDev;
};

