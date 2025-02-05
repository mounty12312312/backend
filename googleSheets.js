const { google } = require('googleapis');

function getAuth() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth;
}

async function readData(range) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth: auth });
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: range,
    });
    return response.data.values;
  } catch (error) {
    console.error('Error reading data from Google Sheets:', error);
    throw error;
  }
}

async function writeData(range, values) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth: auth });
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: { values: values },
    });
  } catch (error) {
    console.error('Error writing data to Google Sheets:', error);
    throw error;
  }
}

module.exports = { readData, writeData };