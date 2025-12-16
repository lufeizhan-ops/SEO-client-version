/**
 * Authentication Service for Client Portal
 * Handles email-based authentication for campaign access
 */

import { supabase } from './supabaseClient';

// Session storage key
const AUTH_EMAIL_KEY = 'client_portal_email';
const AUTH_CAMPAIGN_KEY = 'client_portal_campaign';

/**
 * Verify if an email has access to a specific campaign
 * Returns true if the email belongs to a contact whose client is associated with the campaign
 */
export async function verifyEmailAccess(email: string, campaignId: string): Promise<boolean> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Step 1: Find the contact by email
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('client_id')
      .eq('email', normalizedEmail)
      .single();

    if (contactError || !contact) {
      console.log('Contact not found for email:', normalizedEmail);
      return false;
    }

    // Step 2: Check if the contact's client is associated with the campaign
    const { data: association, error: assocError } = await supabase
      .from('campaign_clients')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('client_id', contact.client_id)
      .single();

    if (assocError || !association) {
      console.log('Client not associated with campaign:', campaignId);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error verifying email access:', err);
    return false;
  }
}

/**
 * Get contact info by email
 */
export async function getContactByEmail(email: string): Promise<{
  id: string;
  name: string;
  email: string;
  clientId: string;
  clientName: string;
} | null> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Fetch contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, name, email, client_id')
      .eq('email', normalizedEmail)
      .single();

    if (contactError || !contact) {
      return null;
    }

    // Fetch client info separately
    const { data: client } = await supabase
      .from('clients')
      .select('name')
      .eq('id', contact.client_id)
      .single();

    return {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      clientId: contact.client_id,
      clientName: client?.name || 'Unknown Client'
    };
  } catch (err) {
    console.error('Error getting contact by email:', err);
    return null;
  }
}

/**
 * Attempt to log in with email for a specific campaign
 */
export async function login(email: string, campaignId: string): Promise<{
  success: boolean;
  error?: string;
  contactName?: string;
  clientName?: string;
}> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    // Verify access
    const hasAccess = await verifyEmailAccess(normalizedEmail, campaignId);
    
    if (!hasAccess) {
      return { 
        success: false, 
        error: 'Access denied. Your email is not authorized to access this campaign.' 
      };
    }

    // Get contact info
    const contactInfo = await getContactByEmail(normalizedEmail);
    
    // Store in sessionStorage
    sessionStorage.setItem(AUTH_EMAIL_KEY, normalizedEmail);
    sessionStorage.setItem(AUTH_CAMPAIGN_KEY, campaignId);

    return { 
      success: true, 
      contactName: contactInfo?.name,
      clientName: contactInfo?.clientName
    };
  } catch (err) {
    console.error('Login error:', err);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}

/**
 * Check if user is currently authenticated for a campaign
 */
export function isAuthenticated(campaignId: string): boolean {
  const storedEmail = sessionStorage.getItem(AUTH_EMAIL_KEY);
  const storedCampaign = sessionStorage.getItem(AUTH_CAMPAIGN_KEY);
  
  return !!(storedEmail && storedCampaign === campaignId);
}

/**
 * Get the currently authenticated email
 */
export function getAuthenticatedEmail(): string | null {
  return sessionStorage.getItem(AUTH_EMAIL_KEY);
}

/**
 * Get the currently authenticated campaign
 */
export function getAuthenticatedCampaign(): string | null {
  return sessionStorage.getItem(AUTH_CAMPAIGN_KEY);
}

/**
 * Log out (clear session)
 */
export function logout(): void {
  sessionStorage.removeItem(AUTH_EMAIL_KEY);
  sessionStorage.removeItem(AUTH_CAMPAIGN_KEY);
}

/**
 * Re-verify access (called on page load to ensure access is still valid)
 */
export async function revalidateAccess(campaignId: string): Promise<boolean> {
  const storedEmail = sessionStorage.getItem(AUTH_EMAIL_KEY);
  const storedCampaign = sessionStorage.getItem(AUTH_CAMPAIGN_KEY);
  
  // If not authenticated for this campaign, return false
  if (!storedEmail || storedCampaign !== campaignId) {
    return false;
  }
  
  // Verify access is still valid in database
  const hasAccess = await verifyEmailAccess(storedEmail, campaignId);
  
  if (!hasAccess) {
    // Clear invalid session
    logout();
    return false;
  }
  
  return true;
}

