/**
 * DigiLocker Document Parser
 * Parses XML documents from DigiLocker (Aadhaar, PAN) into structured JSON
 */

import axios from 'axios';
import xml2js from 'xml2js';
import logger from './logger.js';

/**
 * Aadhaar data structure
 */
export interface AadhaarParsedData {
    uid: string;              // Masked Aadhaar number (XXXX XXXX 1234)
    name: string;
    gender: string;           // M/F
    dob: string;              // DD-MM-YYYY format
    yearOfBirth?: string;
    address: string;          // Full formatted address
    photo?: string;           // Base64 photo if available
    // Address components
    addressComponents?: {
        co?: string;          // Care of (S/O, D/O, W/O)
        house?: string;
        street?: string;
        landmark?: string;
        locality?: string;
        vtc?: string;         // Village/Town/City
        district?: string;
        state?: string;
        pincode?: string;
    };
}

/**
 * PAN data structure from DigiLocker
 */
export interface PanParsedData {
    number: string;           // PAN number
    name: string;             // Name as per PAN
    fatherName?: string;
    dob?: string;
}

/**
 * Fetch XML content from URL and parse it
 */
export async function fetchAndParseDocument(url: string): Promise<string> {
    try {
        const response = await axios.get(url, {
            timeout: 30000,
            responseType: 'text',
        });
        return response.data;
    } catch (error: any) {
        logger.error('[DigiLocker] Failed to fetch document:', error.message);
        throw new Error(`Failed to fetch document from DigiLocker: ${error.message}`);
    }
}

/**
 * Parse Aadhaar XML to structured data
 * 
 * Expected XML format (PrintLetterBarcodeData):
 * <PrintLetterBarcodeData uid="XXXX XXXX 1234" name="JOHN DOE" 
 *   gender="M" yob="1990" dob="15-01-1990"
 *   co="S/O FATHER NAME" house="123" street="STREET" 
 *   lm="LANDMARK" loc="LOCALITY" vtc="CITY" 
 *   dist="DISTRICT" state="STATE" pc="123456" />
 */
export async function parseAadhaarXml(xmlContent: string): Promise<AadhaarParsedData> {
    try {
        const parser = new xml2js.Parser({
            explicitArray: false,
            ignoreAttrs: false,
            attrkey: '$',
            charkey: '_',
        });

        const result = await parser.parseStringPromise(xmlContent);

        // Handle different possible root elements
        let uidData: any = null;

        // Check for PrintLetterBarcodeData (flat format)
        if (result.PrintLetterBarcodeData) {
            const plbd = result.PrintLetterBarcodeData.$ || result.PrintLetterBarcodeData;
            return {
                uid: plbd.uid || '',
                name: plbd.name || '',
                gender: plbd.gender || '',
                dob: plbd.dob || '',
                yearOfBirth: plbd.yob || '',
                address: [plbd.co, plbd.house, plbd.street, plbd.lm, plbd.loc, plbd.vtc, plbd.dist, plbd.state, plbd.pc].filter(Boolean).join(', '),
                photo: plbd.pht || '',
                addressComponents: {
                    co: plbd.co || '', house: plbd.house || '', street: plbd.street || '',
                    landmark: plbd.lm || '', locality: plbd.loc || '', vtc: plbd.vtc || '',
                    district: plbd.dist || '', state: plbd.state || '', pincode: plbd.pc || '',
                },
            };
        }
        // Check for Certificate > CertificateData > KycRes > UidData format
        else if (result.Certificate?.CertificateData?.KycRes?.UidData) {
            uidData = result.Certificate.CertificateData.KycRes.UidData;
        }
        // Check for KycRes format (UIDAI response)
        else if (result.KycRes?.UidData) {
            uidData = result.KycRes.UidData;
        }
        // Check for OfflinePaperlessKyc format
        else if (result.OfflinePaperlessKyc?.UidData) {
            uidData = result.OfflinePaperlessKyc.UidData;
        }

        if (!uidData) {
            logger.warn('[DigiLocker] Unknown Aadhaar XML format, keys:', Object.keys(result));
            throw new Error('Unknown Aadhaar XML format - UidData not found');
        }

        logger.info(`[DigiLocker] UidData keys: ${JSON.stringify(Object.keys(uidData))}`);

        // Extract Poi (Proof of Identity) - contains name, dob, gender
        const poi = uidData.Poi?.$ || uidData.Poi || {};
        logger.info(`[DigiLocker] Poi data: ${JSON.stringify(poi)}`);

        // Extract Poa (Proof of Address)
        const poa = uidData.Poa?.$ || uidData.Poa || {};

        // Extract Photo (base64)
        const pht = uidData.Pht?._ || uidData.Pht || '';

        // Get UID from UidData attributes
        const uidAttrs = uidData.$ || {};

        // Build address from Poa
        const addressParts = [
            poa.loc, poa.vtc, poa.dist, poa.state, poa.country, poa.pc
        ].filter(Boolean).join(', ');

        // Extract address components from Poa
        const addressComponents = {
            co: poa.co || '',
            house: poa.house || '',
            street: poa.street || '',
            landmark: poa.lm || poa.landmark || '',
            locality: poa.loc || '',
            vtc: poa.vtc || '',
            district: poa.dist || '',
            state: poa.state || '',
            pincode: poa.pc || '',
        };

        const parsedData: AadhaarParsedData = {
            uid: uidAttrs.uid || '',
            name: poi.name || '',
            gender: poi.gender || '',
            dob: poi.dob || '',
            address: addressParts,
            photo: pht,
            addressComponents,
        };

        if (!parsedData.name) {
            logger.error('[DigiLocker] Name missing in Aadhaar Poi. Poi data:', JSON.stringify(poi));
            logger.error('[DigiLocker] UidData keys:', Object.keys(uidData));
            throw new Error('Name not found in Aadhaar XML Poi element');
        }

        logger.info(`[DigiLocker] Parsed Aadhaar: Name="${parsedData.name}", UID="${parsedData.uid}", DOB="${parsedData.dob}"`);

        return parsedData;
    } catch (error: any) {
        logger.error('[DigiLocker] Failed to parse Aadhaar XML:', error.message);
        throw new Error(`Failed to parse Aadhaar XML: ${error.message}`);
    }
}

/**
 * Parse PAN XML from DigiLocker
 * 
 * Handles multiple XML formats including:
 * - PANCard element format
 * - Certificate/CertificateData format
 * - NSDL ePAN format
 * - Attribute-based formats
 */
export async function parsePanXml(xmlContent: string): Promise<PanParsedData> {
    try {
        // Log the raw XML for debugging (first 500 chars)
        logger.info(`[DigiLocker] Parsing PAN XML (first 500 chars): ${xmlContent.substring(0, 500)}`);

        const parser = new xml2js.Parser({
            explicitArray: false,
            ignoreAttrs: false,
            attrkey: '$',
            charkey: '_',
        });

        const result = await parser.parseStringPromise(xmlContent);
        logger.info(`[DigiLocker] PAN XML root keys: ${JSON.stringify(Object.keys(result))}`);

        let data: any = null;
        let panNumber = '';
        let name = '';
        let fatherName = '';
        let dob = '';

        // Check for PANCard element
        if (result.PANCard) {
            data = result.PANCard.$ || result.PANCard;
        }
        // Check for Certificate format
        else if (result.Certificate?.CertificateData?.PANDetails) {
            data = result.Certificate.CertificateData.PANDetails.$ || result.Certificate.CertificateData.PANDetails;
        }
        // Check for NSDL format
        else if (result.PAN) {
            data = result.PAN.$ || result.PAN;
        }
        // Check for ePAN format (NSDL DigiLocker)
        else if (result.ePAN) {
            data = result.ePAN.$ || result.ePAN;
        }
        // Check for EPAN format
        else if (result.EPAN) {
            data = result.EPAN.$ || result.EPAN;
        }
        // Check for pan_card format
        else if (result.pan_card) {
            data = result.pan_card.$ || result.pan_card;
        }
        // Check if root element has $ (attributes)
        else {
            const rootKey = Object.keys(result)[0];
            if (rootKey && result[rootKey]?.$) {
                data = result[rootKey].$;
                logger.info(`[DigiLocker] Using root element attributes from: ${rootKey}`);
            } else if (rootKey && typeof result[rootKey] === 'object') {
                data = result[rootKey];
                logger.info(`[DigiLocker] Using root element data from: ${rootKey}`);
            }
        }

        // ==========================================
        // FIXED: Extract Name from Certificate > IssuedTo > Person
        // ==========================================
        if (result.Certificate?.IssuedTo?.Person?.$?.name) {
            name = result.Certificate.IssuedTo.Person.$.name;
            logger.info(`[DigiLocker] Extracted Name from IssuedTo.Person: ${name}`);
        } else if (data) {
            name = data.Name || data.name || data.fullName || data.full_name || data.holder_name || data.holderName || '';
        }

        // Fix for "PAN Verification Record" mistakenly being used as name
        if (name === 'PAN Verification Record') {
            name = '';
            // Try to find name in other attributes if it was overwritten
            if (data?.holder_name) name = data.holder_name;
        }

        if (data) {
            // Extract from various possible field names
            panNumber = data.PANNumber || data.pan || data.permanentAccountNumber ||
                data.pan_no || data.panNumber || data.PAN || data.number || '';

            fatherName = data.FatherName || data.fatherName || data.father_name || '';
            dob = data.DOB || data.dob || data.dateOfBirth || data.date_of_birth || '';
        }

        // Extract DOB from IssuedTo if available
        if (!dob && result.Certificate?.IssuedTo?.Person?.$?.dob) {
            dob = result.Certificate.IssuedTo.Person.$.dob;
        }

        // Fallback: Extract PAN number using regex from raw XML
        if (!panNumber) {
            const panRegex = /[A-Z]{5}[0-9]{4}[A-Z]{1}/g;
            const matches = xmlContent.match(panRegex);
            if (matches && matches.length > 0) {
                panNumber = matches[0];
                logger.info(`[DigiLocker] Extracted PAN via regex: ${panNumber}`);
            }
        }

        // Fallback: Extract name from common XML patterns
        if (!name && xmlContent) {
            const nameMatch = xmlContent.match(/<[Nn]ame[^>]*>([^<]+)<\/[Nn]ame>/);
            if (nameMatch) {
                name = nameMatch[1].trim();
                logger.info(`[DigiLocker] Extracted name via regex: ${name}`);
            }
        }

        if (!panNumber) {
            logger.warn('[DigiLocker] Could not extract PAN number from XML');
            logger.warn(`[DigiLocker] Full XML content: ${xmlContent}`);
            throw new Error('Could not extract PAN number from XML');
        }

        const parsedData: PanParsedData = {
            number: panNumber.toUpperCase(),
            name: name,
            fatherName: fatherName,
            dob: dob,
        };

        logger.info(`[DigiLocker] Parsed PAN: Number="${parsedData.number}", Name="${parsedData.name}"`);

        return parsedData;
    } catch (error: any) {
        logger.error('[DigiLocker] Failed to parse PAN XML:', error.message);
        throw new Error(`Failed to parse PAN XML: ${error.message}`);
    }
}

/**
 * Fetch and parse DigiLocker Aadhaar document
 */
export async function fetchAndParseAadhaar(documentUrl: string): Promise<AadhaarParsedData> {
    const xmlContent = await fetchAndParseDocument(documentUrl);
    return parseAadhaarXml(xmlContent);
}

/**
 * Fetch and parse DigiLocker PAN document
 */
export async function fetchAndParsePan(documentUrl: string): Promise<PanParsedData> {
    const xmlContent = await fetchAndParseDocument(documentUrl);
    return parsePanXml(xmlContent);
}

/**
 * Transform Aadhaar parsed data to Application.kyc.aadhaar format
 */
export function transformAadhaarToKycFormat(parsedData: AadhaarParsedData) {
    return {
        maskedNumber: parsedData.uid.replace(/\s/g, ''),
        name: parsedData.name,
        dob: parsedData.dob,
        gender: parsedData.gender,
        address: parsedData.address,
        photo: parsedData.photo,
        verifiedAt: new Date(),
    };
}

/**
 * Transform PAN parsed data to Application.kyc.pan format
 */
export function transformPanToKycFormat(parsedData: PanParsedData) {
    return {
        number: parsedData.number.toUpperCase(),
        name: parsedData.name,
        verified: true,
        verifiedAt: new Date(),
    };
}

export default {
    fetchAndParseDocument,
    parseAadhaarXml,
    parsePanXml,
    fetchAndParseAadhaar,
    fetchAndParsePan,
    transformAadhaarToKycFormat,
    transformPanToKycFormat,
};
