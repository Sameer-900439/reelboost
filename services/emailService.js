const sendOTP = async (toEmail, code) => {
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyYJF1H-o7ds6glYWqUBmPym9q8yyaDus7wVTWV_wgSfG4e7kRmFV7xR9NLPDL9rDBRuw/exec";

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: toEmail, code: code }),
      redirect: 'follow'
    });

    const text = await response.text();
    // If it returns HTML with "Drive", it means permissions are wrong
    if (text.includes('Drive') || text.includes('unable to open')) {
      throw new Error('Google Apps Script requires "Who has access" to be "Anyone"');
    }

    console.log(`📧 OTP sent to ${toEmail} via Apps Script`);
    return true;
  } catch (error) {
    console.error(`❌ Email send error to ${toEmail}:`, error.message);
    throw new Error('Failed to send OTP. Ensure your Google Script permissions are set to "Anyone"');
  }
};

module.exports = { sendOTP };
