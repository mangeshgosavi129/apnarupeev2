/**
 * Company Entity Data Mapper (Pvt Ltd / LLP / OPC)
 * Transforms v4.0 Application data → PDF fields for Company workflow
 * 
 * Company-specific data:
 * - Directors imported from MCA API (each with Aadhaar + PAN KYC)
 * - One signatory director with selfie
 * - Company-level documents: AOA/MOU, GST, Udyog Aadhaar, Company PAN
 * - References as witnesses
 */

const { ENTITY_TYPES, COMPANY_SUB_TYPES } = require('../config/constants');

/**
 * Format address from Aadhaar object or string to single string
 */
function formatAddress(addressData) {
    if (!addressData) return '';

    // If already a string, return it
    if (typeof addressData === 'string') return addressData;

    // If it's an object (Aadhaar address format), construct string
    if (typeof addressData === 'object') {
        const parts = [
            addressData.house,
            addressData.street,
            addressData.landmark,
            addressData.loc,
            addressData.vtc,
            addressData.subdist,
            addressData.dist,
            addressData.state,
            addressData.country,
            addressData.pc || addressData.pincode
        ].filter(Boolean);

        return parts.join(', ');
    }

    return String(addressData);
}

/**
 * Map Application data to PDF fields for Company entity
 * @param {Object} application - Application model from v4.0
 * @returns {Object} - Mapped data for PDF generation
 */
function mapCompanyData(application) {
    const directors = application.directors || [];
    const references = application.references || [];
    const company = application.company || {};
    const business = application.business || {};

    // Find signatory director (or first director as fallback)
    const signatory = directors.find(d => d.isSignatory) || directors[0] || {};
    const signatoryKyc = signatory.kyc || {};

    // Get company name
    const companyName = company.name || business.name ||
        application.companyName || application.name || 'Company';

    // Company sub-type
    const companyType = company.type || application.companySubType || COMPANY_SUB_TYPES.PVT_LTD;

    // Get company type label
    const companyTypeLabel = getCompanyTypeLabel(companyType);

    // Company registered address
    const registeredAddress = formatAddress(
        company.registeredAddress ||
        business.registeredAddress ||
        business.businessAddress
    );

    // Signatory residential address
    const signatoryAddress = formatAddress(signatoryKyc.aadhaar?.data?.address);

    // Company PAN
    const companyPan = company.pan?.number || business.pan || application.companyPan || '';

    return {
        entityType: ENTITY_TYPES.COMPANY,
        companySubType: companyType,
        companyType: companyType,

        // ========== Page 1 - Party Details ==========
        // For company, party is the signatory director
        date: formatDate(new Date()),
        name: signatory.name || companyName,
        age: calculateAge(signatoryKyc.aadhaar?.data?.dob || signatoryKyc.aadhaar?.data?.date_of_birth),
        pan: signatoryKyc.pan?.number || '',
        aadhaar: formatAadhaar(signatoryKyc.aadhaar?.maskedNumber || ''),
        residentialAddress: signatoryAddress || registeredAddress,

        // ========== Company Details ==========
        companyName: companyName,
        companyTypeLabel: companyTypeLabel,
        cin: company.cin || '',
        llpin: company.llpin || '',
        companyPan: companyPan,
        dateOfIncorporation: company.dateOfIncorporation || '',
        companyStatus: company.status || 'Active',
        rocCode: company.rocCode || '',

        // For status checkbox
        isLLP: companyType === COMPANY_SUB_TYPES.LLP || companyType === 'llp',
        isPvtLtd: companyType === COMPANY_SUB_TYPES.PVT_LTD || companyType === 'pvt_ltd',
        isOPC: companyType === COMPANY_SUB_TYPES.OPC || companyType === 'opc',

        // DIN for Pvt Ltd/OPC, DPIN for LLP (from signatory)
        dinNo: signatory.din || '',
        dpinNo: signatory.dpin || '',

        // ========== Page 9 - Mail Address ==========
        email: company.email || application.email || signatory.email || '',

        // ========== Page 12 - Witnesses (from References) ==========
        witness1Name: references[0]?.name || directors[0]?.name || '',
        witness2Name: references[1]?.name || directors[1]?.name || '',

        // ========== Page 17 - Application Form ==========
        // Signatory's selfie/photo
        passportPhoto: signatoryKyc.selfie?.image ||
            signatoryKyc.selfiePhoto?.image ||
            signatoryKyc.aadhaar?.photo ||
            application.livenessImage || '',
        applicantName: signatory.name || companyName,
        aadhaarNo: formatAadhaar(signatoryKyc.aadhaar?.maskedNumber || ''),

        // ========== Page 18 - Business Address ==========
        businessAddress: registeredAddress,
        businessMobileNo: application.phone || signatory.mobile || '',

        // ========== Page 18 - Directors Details ==========
        // Map all directors with their KYC data (up to 5)
        persons: directors.slice(0, 5).map((d, index) => ({
            name: d.name || '',
            mobile: d.mobile || '',
            email: d.email || '',
            address: formatAddress(d.kyc?.aadhaar?.data?.address),
            pan: d.kyc?.pan?.number || '',
            aadhaar: formatAadhaar(d.kyc?.aadhaar?.maskedNumber || ''),
            din: d.din || '',
            designation: d.designation || 'Director',
            isSignatory: d.isSignatory || false
        })),

        // ========== All Directors (for signature pages) ==========
        allDirectors: directors.map((d, index) => ({
            name: d.name || '',
            pan: d.kyc?.pan?.number || '',
            din: d.din || '',
            aadhaarLast4: (d.kyc?.aadhaar?.maskedNumber || '').slice(-4),
            designation: d.designation || 'Director',
            isSignatory: d.isSignatory || false
        })),

        // Director count for conditional rendering
        directorCount: directors.length,

        // ========== Signatory Details (for signing page) ==========
        signatory: {
            name: signatory.name || '',
            pan: signatoryKyc.pan?.number || '',
            din: signatory.din || '',
            aadhaar: formatAadhaar(signatoryKyc.aadhaar?.maskedNumber || ''),
            address: signatoryAddress,
            mobile: signatory.mobile || '',
            email: signatory.email || '',
            designation: signatory.designation || 'Director'
        }
    };
}

/**
 * Get human-readable company type label
 */
function getCompanyTypeLabel(type) {
    switch (type) {
        case COMPANY_SUB_TYPES.PVT_LTD:
        case 'pvt_ltd':
            return 'Private Limited Company';
        case COMPANY_SUB_TYPES.LLP:
        case 'llp':
            return 'Limited Liability Partnership';
        case COMPANY_SUB_TYPES.OPC:
        case 'opc':
            return 'One Person Company';
        default:
            return 'Company';
    }
}

/**
 * Format date as DD-MM-YYYY
 */
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

/**
 * Format Aadhaar with spaces: XXXX XXXX XXXX
 */
function formatAadhaar(aadhaar) {
    const clean = String(aadhaar).replace(/\D/g, '');
    if (clean.length !== 12) return aadhaar;
    return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)}`;
}

module.exports = { mapCompanyData };
