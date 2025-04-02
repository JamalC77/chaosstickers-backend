export interface ShippingDetails {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  address1: string;
  address2?: string; // Optional
  city: string;
  zip: string;
}

// Add other shared types here as needed 