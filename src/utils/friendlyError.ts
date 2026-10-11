/**
 * Unified Error Handling & Human-Readable Translation System
 * Intercepts technical API, Firebase Auth, Gemini, network, and system errors
 * and translates them into welcoming, actionable, human-friendly guidance.
 */

export interface FriendlyError {
  title: string;
  message: string;
  suggestion: string;
  code?: string;
  actionType?: 'retry' | 'fallback_login' | 'allow_popups' | 'open_new_tab' | 'check_settings' | 'dismiss';
  actionLabel?: string;
}

export function parseFriendlyError(error: any, context?: string): FriendlyError {
  if (!error) {
    return {
      title: 'Something unexpected happened',
      message: 'A minor hiccup occurred.',
      suggestion: 'Please try again in a moment.',
      actionType: 'retry',
      actionLabel: 'Try Again'
    };
  }

  const rawMsg = typeof error === 'string' 
    ? error 
    : (error.message || error.code || error.error || JSON.stringify(error));
  const errCode = (error.code || error.status || '').toString().toLowerCase();

  // Firebase Auth: Unauthorized Domain (Cloud Run / dev preview iframe)
  if (
    errCode.includes('unauthorized-domain') || 
    rawMsg.includes('unauthorized-domain') ||
    rawMsg.includes('This domain is not authorized')
  ) {
    return {
      title: 'Domain Needs Firebase Authorization',
      message: 'This web address has not been added to your Firebase project yet.',
      suggestion: 'To use real Google Cloud sign-in, add this preview URL to Authorized Domains in your Firebase Console (Authentication > Settings > Authorized Domains). Or click below for Instant Google Access!',
      code: 'auth/unauthorized-domain',
      actionType: 'fallback_login',
      actionLabel: 'Use Instant Google Sign-In'
    };
  }

  // Firebase Auth: Popup Blocked by Browser/Iframe
  if (
    errCode.includes('popup-blocked') || 
    rawMsg.includes('popup-blocked') || 
    rawMsg.includes('popup was blocked')
  ) {
    return {
      title: 'Sign-In Window Was Blocked',
      message: 'Your browser prevented the Google login popup window from opening.',
      suggestion: 'Look for the popup icon in your browser address bar and select "Always allow popups for this site". Alternatively, use Instant Sign-In to start immediately!',
      code: 'auth/popup-blocked',
      actionType: 'allow_popups',
      actionLabel: 'Continue with Instant Sign-In'
    };
  }

  // Firebase Auth: Popup closed by user
  if (
    errCode.includes('popup-closed-by-user') || 
    rawMsg.includes('popup-closed-by-user') ||
    rawMsg.includes('window closed before completing')
  ) {
    return {
      title: 'Sign-In Window Closed',
      message: 'The Google sign-in window was closed before signing in.',
      suggestion: 'No problem! Whenever you are ready, click "Sign in with Google" again.',
      code: 'auth/popup-closed-by-user',
      actionType: 'retry',
      actionLabel: 'Try Signing In Again'
    };
  }

  // Firebase Auth: Cancelled popup request
  if (errCode.includes('cancelled-popup-request') || rawMsg.includes('cancelled-popup-request')) {
    return {
      title: 'Sign-In Request Reset',
      message: 'A previous sign-in window was open or cancelled.',
      suggestion: 'Wait a quick moment and tap the button once more to sign in cleanly.',
      code: 'auth/cancelled-popup-request',
      actionType: 'retry',
      actionLabel: 'Retry Sign-In'
    };
  }

  // Firebase unconfigured / missing credentials
  if (
    rawMsg.includes('Firebase is not yet configured') || 
    rawMsg.includes('Credentials not configured') ||
    rawMsg.includes('mock-api-key') ||
    rawMsg.includes('bittybox-mock')
  ) {
    return {
      title: 'Ready for Quick Sign-In',
      message: 'Live Firebase cloud keys are not configured in this environment yet.',
      suggestion: 'You can connect your Firebase project in Settings, or use Instant Google Access right now to store your work on this device!',
      code: 'firebase/unconfigured',
      actionType: 'fallback_login',
      actionLabel: 'Sign In Instantly'
    };
  }

  // Microphone permission denied (Voice AI)
  if (
    errCode.includes('notallowederror') || 
    errCode.includes('permissiondeniederror') || 
    rawMsg.includes('NotAllowedError') ||
    rawMsg.includes('Permission denied') ||
    rawMsg.includes('microphone')
  ) {
    return {
      title: 'Microphone Permission Needed',
      message: 'Conversational Voice AI needs permission to hear your voice.',
      suggestion: 'Click the camera/microphone icon in your browser address bar, choose "Allow", and tap the microphone icon again to speak.',
      code: 'voice/mic-denied',
      actionType: 'retry',
      actionLabel: 'Check Permission & Retry'
    };
  }

  // Gemini API Key missing or invalid
  if (
    rawMsg.includes('GEMINI_API_KEY') || 
    rawMsg.includes('API_KEY_INVALID') || 
    rawMsg.includes('API key not valid') ||
    errCode === '400' && rawMsg.includes('key')
  ) {
    return {
      title: 'AI Key Needed',
      message: 'Conversational Voice AI needs a Gemini API Key to connect.',
      suggestion: 'Add your Gemini API Key in the Settings panel to enable real-time Live voice chats and Search Grounding.',
      code: 'gemini/key-missing',
      actionType: 'check_settings',
      actionLabel: 'Open Settings'
    };
  }

  // Gemini Rate Limit / Quota
  if (
    rawMsg.includes('RESOURCE_EXHAUSTED') || 
    errCode === '429' || 
    rawMsg.includes('quota') ||
    rawMsg.includes('rate limit')
  ) {
    return {
      title: 'AI Voice is Busy',
      message: 'The AI model is handling a high volume of requests at this second.',
      suggestion: 'Take a quick pause and try speaking again in 10-15 seconds.',
      code: 'gemini/rate-limit',
      actionType: 'retry',
      actionLabel: 'Retry Conversation'
    };
  }

  // Network connection error
  if (
    rawMsg.includes('Failed to fetch') || 
    rawMsg.includes('NetworkError') || 
    rawMsg.includes('network error') ||
    rawMsg.includes('fetch failed')
  ) {
    return {
      title: 'Connection Paused',
      message: 'We had trouble connecting to the network service.',
      suggestion: 'Check your internet connection or Wi-Fi, then click retry to pick up where you left off.',
      code: 'network/offline',
      actionType: 'retry',
      actionLabel: 'Retry Connection'
    };
  }

  // Default context-aware fallback
  let defaultTitle = 'Notice';
  if (context === 'auth') defaultTitle = 'Sign-In Help';
  else if (context === 'voice') defaultTitle = 'Voice AI Status';
  else if (context === 'storage') defaultTitle = 'Saving Work';

  return {
    title: defaultTitle,
    message: cleanTechnicalJargon(rawMsg),
    suggestion: 'If this issue continues, try refreshing the page or checking your network connection.',
    actionType: 'retry',
    actionLabel: 'Try Again'
  };
}

/**
 * Strips raw code traces and converts them into friendly sentences
 */
function cleanTechnicalJargon(msg: string): string {
  if (!msg) return 'A brief hiccup occurred. Please try again.';
  // Strip stack traces or URL parameters
  let clean = msg.replace(/\bat\s+[^\n]+/g, '').replace(/https?:\/\/[^\s]+/g, '');
  if (clean.length > 180) {
    clean = clean.slice(0, 180) + '...';
  }
  return clean.trim() || 'A brief hiccup occurred. Please try again.';
}
