import { EmailService } from './services/emailService';

async function testEmail() {
  try {
    console.log('Testing email service...');
    
    // Test basic email
    const result = await EmailService.sendEmail(
      'test@example.com', // Replace with your email to test
      'Test Email from Decisions',
      'This is a test email from the Decisions application.',
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Test Email</h2>
          <p>This is a test email from the Decisions application.</p>
          <p>This email was sent at: ${new Date().toLocaleString()}</p>
        </div>
      `
    );
    
    console.log('Email sent successfully!');
    console.log('Message ID:', result.messageId);
    
    // Test template email
    console.log('\nTesting template email...');
    const templateResult = await EmailService.sendTemplateEmail(
      'test@example.com', // Replace with your email to test
      'welcome',
      { name: 'Test User' }
    );
    
    console.log('Template email sent successfully!');
    console.log('Message ID:', templateResult.messageId);
    
  } catch (error) {
    console.error('Error in email test:', error);
  }
}

// Run the test
testEmail();