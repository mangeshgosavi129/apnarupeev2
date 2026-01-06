/**
 * Sole Proprietorship Entity Data Mapper
 * Transforms v3.0 Application data → PDF fields for Sole Proprietorship workflow
 */

const { ENTITY_TYPES } = require('../config/constants');

/**
 * Map Application data to PDF fields for Sole Proprietorship entity
 * @param {Object} application - Application model from v3.0
 * @returns {Object} - Mapped data for PDF generation
 */
function mapProprietorshipData(application) {
    const kyc = application.kyc || {};
    const aadhaar = kyc.aadhaar || {};
    const pan = kyc.pan || {};
    const references = application.references || [];
    const business = application.business || {};

    // Handle both nested (data.name) and flat (name) formats
    const aadhaarName = aadhaar.data?.name || aadhaar.name || '';
    const aadhaarDob = aadhaar.data?.dob || aadhaar.dob || '';
    const aadhaarAddress = aadhaar.data?.address || aadhaar.address || '';
    const aadhaarNumber = aadhaar.maskedNumber || aadhaar.uid || '';
    const panNumber = pan.number || '';

    // Business address: use Aadhaar address as fallback (docs are just uploads without API data)
    const businessAddress = application.businessAddress ||
        business.businessAddress ||
        business.registeredAddress ||
        aadhaarAddress || '';

    return {
        entityType: ENTITY_TYPES.PROPRIETORSHIP,

        // Page 1 - Party Details
        date: formatDate(new Date()),
        name: aadhaarName || application.name || '',
        age: calculateAge(aadhaarDob),
        pan: panNumber,
        aadhaar: formatAadhaar(aadhaarNumber),
        residentialAddress: aadhaarAddress || '',

        // Page 9 - Mail Address (from user registration)
        email: application.email || '',

        // Page 12 - Witnesses
        witness1Name: references[0]?.name || '',
        witness2Name: references[1]?.name || '',

        // Page 17 - Application Form
        passportPhoto: kyc.selfie?.image || application.faceMatchImage || application.livenessImage || kyc.faceMatch?.image || kyc.liveness?.image || '',
        applicantName: aadhaarName || application.name || '',
        aadhaarNo: formatAadhaar(aadhaarNumber),

        // Page 18 - Business Address (fallback to residential if not set)
        businessAddress: businessAddress,
        businessMobileNo: application.phone || '',

        // Page 18 - References
        persons: references.slice(0, 2).map(ref => ({
            name: ref.name || '',
            mobile: ref.mobile || '',
            email: ref.email || '',
            address: ref.address || ''
        }))
    };
}

function formatDate(date) {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

/**
 * Calculate age from DOB
 * Handles multiple formats: DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, ISO dates
 */
function calculateAge(dob) {
    if (!dob) return '';

    let birthDate;

    // Handle DD-MM-YYYY or DD/MM/YYYY format (common in India/Aadhaar)
    if (typeof dob === 'string' && /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(dob)) {
        const parts = dob.split(/[-/]/);
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const year = parseInt(parts[2], 10);
        birthDate = new Date(year, month, day);
    } else {
        birthDate = new Date(dob);
    }

    if (isNaN(birthDate.getTime())) return '';

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age > 0 ? String(age) : '';
}

function formatAadhaar(aadhaar) {
    const clean = String(aadhaar).replace(/\D/g, '');
    if (clean.length !== 12) return aadhaar;
    return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)}`;
}

module.exports = { mapProprietorshipData };

