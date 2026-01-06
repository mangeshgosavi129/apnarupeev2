/**
 * Partnership Firm Entity Data Mapper
 * Transforms v4.0 Application data → PDF fields for Partnership workflow
 * 
 * Partnership-specific data:
 * - Multiple partners (2-10), each with Aadhaar + PAN KYC
 * - One signatory partner with selfie
 * - Firm-level documents: Partnership Deed, Address Proof, GST, Business PAN, Udyam
 * - References as witnesses
 */

const { ENTITY_TYPES } = require('../config/constants');

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
 * Map Application data to PDF fields for Partnership entity
 * @param {Object} application - Application model from v4.0
 * @returns {Object} - Mapped data for PDF generation
 */
function mapPartnershipData(application) {
    const partners = application.partners || [];
    const references = application.references || [];
    const business = application.business || {};

    // Find signatory partner (or first partner as fallback)
    const signatory = partners.find(p => p.isSignatory || p.isLeadPartner) || partners[0] || {};

    // Get KYC data - use kycData directly for complete access
    const signatoryKycData = signatory.kycData || signatory.kyc || {};
    const signatoryAadhaar = signatoryKycData.aadhaar || {};
    const signatoryPan = signatoryKycData.pan || {};
    const signatorySelfie = signatoryKycData.selfie || {};

    // DEBUG: Log signatory data
    console.log('[Partnership Mapper] Signatory name:', signatory.name);
    console.log('[Partnership Mapper] isLeadPartner:', signatory.isLeadPartner);
    console.log('[Partnership Mapper] kycData keys:', Object.keys(signatoryKycData));
    console.log('[Partnership Mapper] signatoryAadhaar keys:', Object.keys(signatoryAadhaar));
    console.log('[Partnership Mapper] signatoryAadhaar.data keys:', Object.keys(signatoryAadhaar.data || {}));
    console.log('[Partnership Mapper] signatoryAadhaar.data.name:', signatoryAadhaar.data?.name);
    console.log('[Partnership Mapper] signatoryAadhaar.data.dob:', signatoryAadhaar.data?.dob);
    console.log('[Partnership Mapper] signatorySelfie.image exists:', !!signatorySelfie.image);
    console.log('[Partnership Mapper] signatorySelfie.image length:', signatorySelfie.image?.length || 0);

    // Handle both nested (data.name) and flat (name) formats for signatory
    const signatoryName = signatoryAadhaar.data?.name || signatoryAadhaar.name || signatory.name || '';
    const signatoryDob = signatoryAadhaar.data?.dob || signatoryAadhaar.dob || signatoryAadhaar.data?.date_of_birth || '';
    const signatoryAadhaarAddress = signatoryAadhaar.data?.address || signatoryAadhaar.address || '';
    const signatoryAadhaarNumber = signatoryAadhaar.maskedNumber || signatory.aadhaarMasked || '';
    const signatoryPanNumber = signatoryPan.number || signatory.panNumber || '';

    // Get firm name
    const firmName = application.firmName || application.name ||
        `${signatory.name || ''} & Partners`.trim();

    // Business address - convert object to string
    const businessAddress = formatAddress(
        application.businessAddress ||
        business.businessAddress ||
        business.registeredAddress ||
        signatoryAadhaarAddress
    );

    // Signatory residential address - convert object to string
    const signatoryAddress = formatAddress(signatoryAadhaarAddress);

    // Firm PAN from business object or application or signatory PAN
    const firmPan = application.firmPan ||
        business.firmPan ||
        signatoryPanNumber || '';

    return {
        entityType: ENTITY_TYPES.PARTNERSHIP,

        // ========== Page 1 - Party Details ==========
        // For partnership, party is the signatory partner
        date: formatDate(new Date()),
        name: signatoryName || firmName,
        age: calculateAge(signatoryDob),
        pan: signatoryPanNumber || firmPan,
        aadhaar: formatAadhaar(signatoryAadhaarNumber),
        residentialAddress: signatoryAddress || businessAddress,

        // ========== Firm Details ==========
        firmName: firmName,
        firmPan: firmPan,

        // ========== Page 9 - Mail Address ==========
        email: application.email || signatory.email || '',

        // ========== Page 12 - Witnesses (from References) ==========
        witness1Name: references[0]?.name || partners[0]?.name || '',
        witness2Name: references[1]?.name || partners[1]?.name || '',

        // ========== Page 17 - Application Form ==========
        // Signatory's selfie/photo (check multiple possible paths)
        passportPhoto: signatorySelfie.image ||
            signatoryAadhaar.data?.photo ||
            signatoryAadhaar.photo ||
            application.livenessImage ||
            application.faceMatchImage || '',
        applicantName: signatoryName || firmName,
        aadhaarNo: formatAadhaar(signatoryAadhaarNumber),

        // ========== Page 18 - Business Address ==========
        businessAddress: businessAddress,
        businessMobileNo: application.phone || signatory.phone || signatory.mobile || '',

        // ========== Page 18 - Partners Details ==========
        // Map all partners with their KYC data
        persons: partners.slice(0, 5).map((p, index) => {
            const pKyc = p.kyc || p.kycData || {};
            const pAadhaar = pKyc.aadhaar || {};
            const pPan = pKyc.pan || {};
            return {
                name: p.name || '',
                mobile: p.phone || p.mobile || '',
                email: p.email || '',
                address: formatAddress(pAadhaar.data?.address || pAadhaar.address || ''),
                pan: pPan.number || p.panNumber || '',
                aadhaar: formatAadhaar(pAadhaar.maskedNumber || p.aadhaarMasked || ''),
                isSignatory: p.isSignatory || p.isLeadPartner || false
            };
        }),

        // ========== All Partners (for signature pages) ==========
        allPartners: partners.map((p, index) => {
            const pKyc = p.kyc || p.kycData || {};
            const pAadhaar = pKyc.aadhaar || {};
            const pPan = pKyc.pan || {};
            return {
                name: p.name || '',
                pan: pPan.number || p.panNumber || '',
                aadhaarLast4: (pAadhaar.maskedNumber || p.aadhaarMasked || '').slice(-4),
                isSignatory: p.isSignatory || p.isLeadPartner || false
            };
        }),

        // Partner count for conditional rendering
        partnerCount: partners.length,

        // ========== Signatory Details (for signing page) ==========
        signatory: {
            name: signatoryName || '',
            pan: signatoryPanNumber || '',
            aadhaar: formatAadhaar(signatoryAadhaarNumber),
            address: signatoryAddress,
            mobile: signatory.phone || signatory.mobile || '',
            email: signatory.email || ''
        }
    };
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

module.exports = { mapPartnershipData };

