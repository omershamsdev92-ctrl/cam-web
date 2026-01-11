// Test Twilio SMS Configuration
// Run: node test-twilio.js

require('dotenv').config();

console.log('\n🔍 Checking Twilio Configuration...\n');

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const PHONE = process.env.TWILIO_PHONE;

// Check if variables are set
if (!ACCOUNT_SID) {
    console.log('❌ TWILIO_ACCOUNT_SID is not set');
} else {
    console.log('✓ TWILIO_ACCOUNT_SID:', ACCOUNT_SID.substring(0, 10) + '...');
}

if (!AUTH_TOKEN) {
    console.log('❌ TWILIO_AUTH_TOKEN is not set');
} else {
    console.log('✓ TWILIO_AUTH_TOKEN:', AUTH_TOKEN.substring(0, 8) + '...');
}

if (!PHONE) {
    console.log('❌ TWILIO_PHONE is not set');
} else {
    console.log('✓ TWILIO_PHONE:', PHONE);
}

if (ACCOUNT_SID && AUTH_TOKEN && PHONE) {
    console.log('\n🎉 All Twilio variables are configured!');
    console.log('\nTesting connection to Twilio...\n');

    try {
        const twilio = require('twilio');
        const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

        // Try to fetch account info
        client.api.accounts(ACCOUNT_SID)
            .fetch()
            .then(account => {
                console.log('✓ Successfully connected to Twilio!');
                console.log('  Account Name:', account.friendlyName);
                console.log('  Account Status:', account.status);
                console.log('\n✅ Twilio is ready to send SMS!\n');
            })
            .catch(error => {
                console.log('❌ Failed to connect to Twilio:');
                console.log('  Error:', error.message);
                console.log('\n💡 Please check your credentials in .env file\n');
            });
    } catch (e) {
        console.log('❌ Twilio module not installed');
        console.log('   Run: npm install\n');
    }
} else {
    console.log('\n⚠️  Please create .env file and add your Twilio credentials');
    console.log('   See TWILIO_SETUP_AR.md for instructions\n');
}
