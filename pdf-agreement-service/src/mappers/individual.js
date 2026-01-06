/**
 * Individual Entity Data Mapper
 * Transforms v3.0 Application data → PDF fields for Individual workflow
 */

const { ENTITY_TYPES } = require('../config/constants');

/**
 * Map Application data to PDF fields for Individual entity
 * @param {Object} application - Application model from v3.0
 * @returns {Object} - Mapped data for PDF generation
 */
function mapIndividualData(application) {
    const kyc = application.kyc || {};
    const references = application.references || [];

    return {
        entityType: ENTITY_TYPES.INDIVIDUAL,

        // Page 1 - Party Details
        date: formatDate(new Date()),
        name: kyc.aadhaar?.data?.name || application.name || '',
        age: calculateAge(kyc.aadhaar?.data?.dob),
        pan: kyc.pan?.number || '',
        aadhaar: formatAadhaar(kyc.aadhaar?.maskedNumber || ''),
        residentialAddress: kyc.aadhaar?.data?.address || application.address || '',

        // Page 9 - Mail Address
        email: application.email || '',

        // Page 12 - Witnesses (from references)
        witness1Name: references[0]?.name || '',
        witness2Name: references[1]?.name || '',

        // Page 17 - Application Form
        passportPhoto: application.faceMatchImage || application.livenessImage || '',
        applicantName: kyc.aadhaar?.data?.name || application.name || '',
        aadhaarNo: formatAadhaar(kyc.aadhaar?.maskedNumber || ''),
        mobileNo: application.phone || '',
        emailAddress: application.email || '',

        // Page 18 - References (as relatives)
        persons: references.slice(0, 2).map(ref => ({
            name: ref.name || '',
            mobile: ref.mobile || '',
            email: ref.email || '',
            address: ref.address || ''
        }))
    };
}

// Helper: Format date as DD-MM-YYYY
function formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

// Helper: Calculate age from DOB
// Supports formats: DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD
function calculateAge(dob) {
    if (!dob) return '';

    let birthDate;
    const dobStr = String(dob).trim();

    // Try DD-MM-YYYY or DD/MM/YYYY format (from Aadhaar API)
    const ddmmyyyyMatch = dobStr.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
    if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1], 10);
        const month = parseInt(ddmmyyyyMatch[2], 10) - 1; // JS months are 0-indexed
        const year = parseInt(ddmmyyyyMatch[3], 10);
        birthDate = new Date(year, month, day);
    } else {
        // Try YYYY-MM-DD format or let Date parse it
        birthDate = new Date(dob);
    }

    // Check if valid date
    if (isNaN(birthDate.getTime())) {
        console.error('Invalid DOB format:', dob);
        return '';
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age > 0 ? String(age) : '';
}

// Helper: Format Aadhaar with spaces
function formatAadhaar(aadhaar) {
    const clean = String(aadhaar).replace(/\D/g, '');
    if (clean.length !== 12) return aadhaar;
    return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)}`;
}

module.exports = { mapIndividualData };
