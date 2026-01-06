/**
 * Test script for PDF Agreement Service
 * Tests all 4 entity types
 */

const fs = require('fs');
const path = require('path');
const { generateAgreementPDF, ENTITY_TYPES, COMPANY_SUB_TYPES } = require('../src');

// Read base64 test image
let testImage = '';
try {
    testImage = fs.readFileSync(path.join(__dirname, '../../making agreement/base64_image'), 'utf8').trim();
} catch (e) {
    console.warn('Test image not found, continuing without...');
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK APPLICATION DATA (simulating v3.0 Application model)
// ═══════════════════════════════════════════════════════════════════════════

const mockApplications = {
    individual: {
        entityType: ENTITY_TYPES.INDIVIDUAL,
        phone: '9876543210',
        email: 'rajesh.kumar@email.com',
        kyc: {
            aadhaar: {
                verified: true,
                maskedNumber: '988877665544',
                data: {
                    name: 'RAJESH KUMAR',
                    dob: '1990-05-15',
                    address: 'Flat 402, Sunshine Apartments, MG Road, Pune, Maharashtra - 411001'
                }
            },
            pan: { verified: true, number: 'ABCDE1234F' }
        },
        livenessImage: testImage,
        references: [
            { name: 'SURESH SHARMA', mobile: '9876543211', email: 'suresh@email.com', address: 'House 12, Green Colony, Mumbai' },
            { name: 'PRIYA VERMA', mobile: '9876543212', email: 'priya@email.com', address: 'B-45, Shanti Nagar, Delhi' }
        ]
    },

    proprietorship: {
        entityType: ENTITY_TYPES.PROPRIETORSHIP,
        phone: '9811223344',
        email: 'amit.enterprises@email.com',
        kyc: {
            aadhaar: {
                verified: true,
                maskedNumber: '112233445566',
                data: {
                    name: 'AMIT VERMA',
                    dob: '1985-08-20',
                    address: '23, Industrial Area, Chandigarh'
                }
            },
            pan: { verified: true, number: 'FGHIJ5678K' }
        },
        businessAddress: 'Shop No. 5, Commercial Complex, Sector 17, Chandigarh - 160017',
        livenessImage: testImage,
        references: [
            { name: 'VIJAY SINGH', mobile: '9811223345', email: 'vijay@email.com', address: 'House 78, Model Town' },
            { name: 'NEHA GUPTA', mobile: '9811223346', email: 'neha@email.com', address: 'Flat 12, Rose Garden' }
        ]
    },

    partnership: {
        entityType: ENTITY_TYPES.PARTNERSHIP,
        firmName: 'M/S SHARMA & ASSOCIATES',
        phone: '9922334455',
        email: 'info@sharmapartners.com',
        firmPan: 'KLMNO9012P',
        businessAddress: '3rd Floor, Trade Tower, BKC, Mumbai - 400051',
        livenessImage: testImage,
        partners: [
            { name: 'RAMESH SHARMA', mobile: '9922334456', email: 'ramesh@firm.com', isSignatory: true, kyc: { aadhaar: { data: { address: 'Villa 5, Navi Mumbai' } } } },
            { name: 'DINESH SHARMA', mobile: '9922334457', email: 'dinesh@firm.com', isSignatory: false, kyc: { aadhaar: { data: { address: 'Flat 801, Worli' } } } }
        ]
    },

    pvtLtd: {
        entityType: ENTITY_TYPES.COMPANY,
        companySubType: COMPANY_SUB_TYPES.PVT_LTD,
        companyName: 'TECH SOLUTIONS PRIVATE LIMITED',
        phone: '9844556677',
        email: 'contact@techsolutions.com',
        companyPan: 'PQRST3456U',
        registeredAddress: 'Unit 501, IT Park, Whitefield, Bangalore - 560066',
        livenessImage: testImage,
        directors: [
            { name: 'ANIL KUMAR', din: '12345678', mobile: '9844556678', email: 'anil@tech.com', isSignatory: true, kyc: { aadhaar: { data: { address: 'HSR Layout, Bangalore' } } } },
            { name: 'SUNITA DEVI', din: '87654321', mobile: '9844556679', email: 'sunita@tech.com', isSignatory: false, kyc: { aadhaar: { data: { address: 'Koramangala, Bangalore' } } } }
        ]
    },

    llp: {
        entityType: ENTITY_TYPES.COMPANY,
        companySubType: COMPANY_SUB_TYPES.LLP,
        companyName: 'GLOBAL CONSULTING LLP',
        phone: '9833445566',
        email: 'info@globalllp.co.in',
        companyPan: 'UVWXY7890Z',
        registeredAddress: '12th Floor, One World Center, Lower Parel, Mumbai - 400013',
        livenessImage: testImage,
        directors: [
            { name: 'RAKESH JAIN', dpin: '11112222', mobile: '9833445567', email: 'rakesh@global.com', isSignatory: true, kyc: { aadhaar: { data: { address: 'Juhu, Mumbai' } } } },
            { name: 'MEERA JAIN', dpin: '33334444', mobile: '9833445568', email: 'meera@global.com', isSignatory: false, kyc: { aadhaar: { data: { address: 'Andheri, Mumbai' } } } }
        ]
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// RUN TESTS
// ═══════════════════════════════════════════════════════════════════════════

async function runTests() {
    console.log('=== PDF AGREEMENT SERVICE - ENTITY TESTS ===\n');

    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    for (const [name, application] of Object.entries(mockApplications)) {
        console.log(`Generating: ${name}...`);
        try {
            const pdfBuffer = await generateAgreementPDF(application);
            const outputPath = path.join(outputDir, `${name}-agreement.pdf`);
            fs.writeFileSync(outputPath, pdfBuffer);
            console.log(`  ✓ ${name}-agreement.pdf (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);
        } catch (error) {
            console.error(`  ✗ ${name}: ${error.message}`);
        }
    }

    console.log('\n=== ALL TESTS COMPLETE ===');
    console.log(`Output directory: ${outputDir}`);
}

runTests();
