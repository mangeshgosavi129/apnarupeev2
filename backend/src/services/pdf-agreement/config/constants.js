/**
 * Constants for PDF Agreement Service
 * Aligned with DSA Onboarding Platform v3.0
 */

// Entity types matching v3.0 Application.entityType
const ENTITY_TYPES = {
    INDIVIDUAL: 'individual',
    PROPRIETORSHIP: 'proprietorship',
    PARTNERSHIP: 'partnership',
    COMPANY: 'company'  // Covers Pvt Ltd, LLP, OPC
};

// Company sub-types for COMPANY entity
const COMPANY_SUB_TYPES = {
    PVT_LTD: 'pvt_ltd',
    LLP: 'llp',
    OPC: 'opc'
};

// Font configuration for PDF
const FONT_CONFIG = {
    defaultSize: 10,
    smallSize: 9,
    color: { r: 0, g: 0, b: 0 }  // Black
};

// PDF page configuration
const PAGE_CONFIG = {
    WIDTH: 612,    // US Letter width in points
    HEIGHT: 792,   // US Letter height in points
    MARGINS: {
        left: 72,
        right: 72,
        top: 72,
        bottom: 72
    }
};

module.exports = {
    ENTITY_TYPES,
    COMPANY_SUB_TYPES,
    FONT_CONFIG,
    PAGE_CONFIG
};
