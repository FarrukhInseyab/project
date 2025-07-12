/**
 * Email Client for interacting with the Email API
 * This client can be used in your frontend application to send emails
 */

const API_BASE_URL = 'http://localhost:3001/api/email';

/**
 * Send a text email
 */
export const sendTextEmail = async (
  to: string,
  subject: string,
  text: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, subject, text }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending text email:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
};

/**
 * Send an HTML email
 */
export const sendHtmlEmail = async (
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/send-html`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, subject, html, text }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending HTML email:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send HTML email',
    };
  }
};

/**
 * Send a password reset email
 */
export const sendPasswordResetEmail = async (
  to: string,
  resetLink: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/password-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, resetLink }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send password reset email',
    };
  }
};

/**
 * Send a welcome email
 */
export const sendWelcomeEmail = async (
  to: string,
  name: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/welcome`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, name }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send welcome email',
    };
  }
};

export const EmailClient = {
  sendTextEmail,
  sendHtmlEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};