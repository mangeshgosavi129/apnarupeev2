import connectDB from '../config/database.js';
import { Application } from '../models/Application.js';
import { env } from '../config/env.js';

// Suppress console logging from imported modules if needed (optional)
// console.log = () => {};

const run = async () => {
    try {
        console.log('Connecting to database...');
        await connectDB();

        console.log('Fetching all applications...');
        const apps = await Application.find({}).sort({ createdAt: -1 });

        console.log(`\nFound ${apps.length} applications:\n`);
        apps.forEach((app, index) => {
            console.log(`--- Application ${index + 1} ---`);
            console.log(`ID: ${app._id}`);
            console.log(`Phone: ${app.phone}`);
            console.log(`Entity Type: ${app.entityType}`);
            console.log(`Status: ${app.status}`);
            console.log(`Created At: ${app.createdAt}`);
            console.log('Completed Steps:', app.completedSteps);
            console.log('KYC:', {
                method: app.kyc?.method,
                aadhaar: app.kyc?.aadhaar?.name ? 'Present' : 'Missing',
                pan: app.kyc?.pan?.number ? 'Present' : 'Missing'
            });
            console.log('Bank:', app.bank ? {
                account: app.bank.accountNumber,
                verified: app.bank.verified,
                flagged: app.bank.flaggedForReview
            } : 'None');
            console.log('-------------------------\n');
        });

        process.exit(0);
    } catch (error) {
        console.error('Error fetching applications:', error);
        process.exit(1);
    }
};

run();
