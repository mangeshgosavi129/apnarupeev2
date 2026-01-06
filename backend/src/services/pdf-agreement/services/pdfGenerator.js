/**
 * PDF Generator Service
 * Core logic for generating entity-specific DSA Agreement PDFs
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { COORDINATES } = require('../config/coordinates');
const { FONT_CONFIG, ENTITY_TYPES } = require('../config/constants');

// Template path
const TEMPLATE_PATH = path.join(__dirname, '../templates/DSA_Agreement_blank.pdf');

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function loadTemplate() {
    const templateBytes = fs.readFileSync(TEMPLATE_PATH);
    return await PDFDocument.load(templateBytes);
}

function drawText(page, text, coords, font, fontSize = FONT_CONFIG.defaultSize) {
    if (!text || text === '') return;
    const { r, g, b } = FONT_CONFIG.color;
    page.drawText(String(text), {
        x: coords.x,
        y: coords.y,
        size: fontSize,
        font: font,
        color: rgb(r, g, b),
        maxWidth: coords.maxWidth || 500
    });
}

function drawCheckbox(page, coords, font) {
    page.drawText('X', {
        x: coords.x,
        y: coords.y,
        size: 12,
        font: font,
        color: rgb(0, 0, 0)
    });
}

function splitText(text, maxChars = 60) {
    if (!text) return [];
    // Coerce to string to prevent 'split is not a function' error
    const textStr = String(text);
    const words = textStr.split(' ');
    const lines = [];
    let currentLine = '';
    for (const word of words) {
        if ((currentLine + ' ' + word).length <= maxChars) {
            currentLine = currentLine ? `${currentLine} ${word}` : word;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
}

async function embedImage(pdfDoc, page, base64Data, coords) {
    if (!base64Data) return;
    try {
        let cleanBase64 = String(base64Data).trim().replace(/\s/g, '');
        const dataUrlMatch = cleanBase64.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
        if (dataUrlMatch) cleanBase64 = dataUrlMatch[2];

        const imageBytes = Buffer.from(cleanBase64, 'base64');
        if (imageBytes.length === 0) return;

        let image;
        try {
            image = await pdfDoc.embedPng(imageBytes);
        } catch {
            image = await pdfDoc.embedJpg(imageBytes);
        }

        const { width: imgW, height: imgH } = image.scale(1);
        const scale = Math.min((coords.width || 100) / imgW, (coords.height || 120) / imgH);

        page.drawImage(image, {
            x: coords.x,
            y: coords.y,
            width: imgW * scale,
            height: imgH * scale
        });
    } catch (error) {
        console.error('Image embed error:', error.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE FILLING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function fillPage1(pages, font, data, entityType) {
    const page = pages[COORDINATES.page1.pageIndex];
    const fields = COORDINATES.page1.fields;

    drawText(page, data.date, fields.date, font);
    drawText(page, data.name, fields.name, font);

    // Age and Aadhaar for Individual/Proprietorship/Partnership (signatory)
    if (entityType === ENTITY_TYPES.INDIVIDUAL || entityType === ENTITY_TYPES.PROPRIETORSHIP || entityType === ENTITY_TYPES.PARTNERSHIP) {
        drawText(page, String(data.age || ''), fields.age, font);
        drawText(page, data.aadhaar, fields.aadhaar, font);
    }

    drawText(page, data.pan, fields.pan, font);

    const address = data.residentialAddress || data.businessAddress || '';
    const lines = splitText(address, 40);
    drawText(page, lines.join(' '), fields.address_line1, font, FONT_CONFIG.smallSize);
}

function fillPage9(pages, font, data) {
    const page = pages[COORDINATES.page9.pageIndex];
    drawText(page, data.email, COORDINATES.page9.fields.secondPartyEmail, font);
}

function fillPage12(pages, font, data) {
    const page = pages[COORDINATES.page12.pageIndex];
    const fields = COORDINATES.page12.fields;

    drawText(page, data.witness1Name, fields.witness1_name, font);
    drawText(page, data.witness2Name, fields.witness2_name, font);
}

async function fillPage17(pdfDoc, pages, font, data, entityType) {
    const page = pages[COORDINATES.page17.pageIndex];
    const fields = COORDINATES.page17.fields;

    // Photo
    if (data.passportPhoto) {
        await embedImage(pdfDoc, page, data.passportPhoto, fields.passportPhoto);
    }

    // Applicant Name
    const nameLines = splitText(data.applicantName, 50);
    if (nameLines[0]) drawText(page, nameLines[0], fields.applicantName, font);
    if (nameLines[1]) drawText(page, nameLines[1], fields.applicantName_line2, font);

    // Aadhaar (Individual/Proprietorship/Partnership)
    if (entityType === ENTITY_TYPES.INDIVIDUAL || entityType === ENTITY_TYPES.PROPRIETORSHIP || entityType === ENTITY_TYPES.PARTNERSHIP) {
        drawText(page, data.aadhaarNo, fields.aadhaarNo, font);
    }

    // DIN/DPIN (Company only)
    if (entityType === ENTITY_TYPES.COMPANY) {
        if (data.dinNo) drawText(page, data.dinNo, fields.dinNo, font);
        if (data.dpinNo) drawText(page, data.dpinNo, fields.dpinNo, font);
    }

    // Status checkbox
    switch (entityType) {
        case ENTITY_TYPES.INDIVIDUAL:
            drawCheckbox(page, fields.status.individual, font);
            break;
        case ENTITY_TYPES.PROPRIETORSHIP:
            drawCheckbox(page, fields.status.proprietorship, font);
            break;
        case ENTITY_TYPES.PARTNERSHIP:
            drawCheckbox(page, fields.status.partnership, font);
            break;
        case ENTITY_TYPES.COMPANY:
            if (data.isLLP) {
                drawCheckbox(page, fields.status.others, font);
                drawText(page, 'LLP', fields.othersSpecify, font);
            } else {
                drawCheckbox(page, fields.status.privateLtd, font);
            }
            break;
    }

    // Residential Address (Individual only)
    if (entityType === ENTITY_TYPES.INDIVIDUAL && data.residentialAddress) {
        const addrLines = splitText(data.residentialAddress, 60);
        if (addrLines[0]) drawText(page, addrLines[0], fields.residentialAddress_line1, font);
        if (addrLines.length > 1) drawText(page, addrLines.slice(1).join(' '), fields.residentialAddress_line2, font);
        drawText(page, data.mobileNo, fields.residentialMobileNo, font);
        drawText(page, data.emailAddress, fields.residentialEmailAddress, font);
    }
}

function fillPage18(pages, font, data, entityType) {
    const page = pages[COORDINATES.page18.pageIndex];
    const fields = COORDINATES.page18.fields;

    // Business Address (non-Individual)
    if (entityType !== ENTITY_TYPES.INDIVIDUAL && data.businessAddress) {
        const bizLines = splitText(data.businessAddress, 60);
        if (bizLines[0]) drawText(page, bizLines[0], fields.businessAddress_line1, font, FONT_CONFIG.smallSize);
        if (bizLines.length > 1) drawText(page, bizLines.slice(1).join(' '), fields.businessAddress_line2, font, FONT_CONFIG.smallSize);
        drawText(page, data.businessMobileNo, fields.businessMobileNo, font);
    }

    // Persons (References/Partners/Directors)
    const persons = data.persons || [];

    if (persons[0]) {
        const p1 = persons[0];
        const f1 = fields.person1;
        drawText(page, p1.name, f1.name, font);
        drawText(page, p1.mobile, f1.mobile, font);
        drawText(page, p1.email, f1.email, font);
        const addr1 = splitText(p1.address, 50);
        if (addr1[0]) drawText(page, addr1[0], f1.address_line1, font, FONT_CONFIG.smallSize);
        if (addr1.length > 1) drawText(page, addr1.slice(1).join(' '), f1.address_line2, font, FONT_CONFIG.smallSize);
    }

    if (persons[1]) {
        const p2 = persons[1];
        const f2 = fields.person2;
        drawText(page, p2.name, f2.name, font);
        drawText(page, p2.mobile, f2.mobile, font);
        drawText(page, p2.email, f2.email, font);
        const addr2 = splitText(p2.address, 50);
        if (addr2[0]) drawText(page, addr2[0], f2.address_line1, font, FONT_CONFIG.smallSize);
        if (addr2.length > 1) drawText(page, addr2.slice(1).join(' '), f2.address_line2, font, FONT_CONFIG.smallSize);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate filled PDF from mapped data
 * @param {Object} mappedData - Data already mapped by entity-specific mapper
 * @returns {Promise<Buffer>} - PDF as buffer
 */
async function generatePDF(mappedData) {
    const entityType = mappedData.entityType;

    const pdfDoc = await loadTemplate();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    fillPage1(pages, font, mappedData, entityType);
    fillPage9(pages, font, mappedData);
    fillPage12(pages, font, mappedData);
    await fillPage17(pdfDoc, pages, font, mappedData, entityType);
    fillPage18(pages, font, mappedData, entityType);

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

module.exports = { generatePDF, loadTemplate };
