/**
 * PDF Agreement Service - Main Entry Point
 * 
 * Usage:
 *   const { generateAgreementPDF } = require('pdf-agreement-service');
 *   const pdfBuffer = await generateAgreementPDF(applicationData);
 */

const { generatePDF } = require('./services/pdfGenerator');
const { mapIndividualData } = require('./mappers/individual');
const { mapProprietorshipData } = require('./mappers/proprietorship');
const { mapPartnershipData } = require('./mappers/partnership');
const { mapCompanyData } = require('./mappers/company');
const { ENTITY_TYPES, COMPANY_SUB_TYPES } = require('./config/constants');

/**
 * Generate DSA Agreement PDF from Application data
 * Automatically selects the correct mapper based on entity type
 * 
 * @param {Object} application - Application model from DSA Platform v3.0
 * @param {string} application.entityType - 'individual', 'proprietorship', 'partnership', 'company'
 * @returns {Promise<Buffer>} - Generated PDF as Buffer
 */
async function generateAgreementPDF(application) {
    const entityType = application.entityType;

    // Map data based on entity type
    let mappedData;
    switch (entityType) {
        case ENTITY_TYPES.INDIVIDUAL:
            mappedData = mapIndividualData(application);
            break;
        case ENTITY_TYPES.PROPRIETORSHIP:
            mappedData = mapProprietorshipData(application);
            break;
        case ENTITY_TYPES.PARTNERSHIP:
            mappedData = mapPartnershipData(application);
            break;
        case ENTITY_TYPES.COMPANY:
            mappedData = mapCompanyData(application);
            break;
        default:
            throw new Error(`Unknown entity type: ${entityType}`);
    }

    // Generate PDF
    return await generatePDF(mappedData);
}

/**
 * Generate PDF from pre-mapped data (direct usage)
 * Use this if you've already transformed the data
 */
async function generatePDFFromMappedData(mappedData) {
    return await generatePDF(mappedData);
}

module.exports = {
    generateAgreementPDF,
    generatePDFFromMappedData,
    ENTITY_TYPES,
    COMPANY_SUB_TYPES,
    // Individual mappers for custom usage
    mappers: {
        mapIndividualData,
        mapProprietorshipData,
        mapPartnershipData,
        mapCompanyData
    }
};
