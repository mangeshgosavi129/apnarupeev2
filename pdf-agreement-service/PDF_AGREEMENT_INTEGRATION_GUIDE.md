# PDF Agreement Service - Integration Guide

> **Complete Documentation for Integrating PDF Agreement Service into DSA Onboarding Platform v3.0**

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Installation](#3-installation)
4. [Architecture](#4-architecture)
5. [Entity-Specific Integration](#5-entity-specific-integration)
6. [Data Mapping Reference](#6-data-mapping-reference)
7. [API Endpoints](#7-api-endpoints)
8. [Workflow Integration Points](#8-workflow-integration-points)
9. [Error Handling](#9-error-handling)
10. [Testing](#10-testing)
11. [Troubleshooting](#11-troubleshooting)
12. [Coordinate Configuration](#12-coordinate-configuration)

---

## 1. Overview

### 1.1 Purpose

The PDF Agreement Service generates pre-filled DSA Agreement PDFs based on entity type. It takes data collected during the onboarding workflow (KYC, bank, references, etc.) and produces a PDF ready for E-Stamp and E-Sign.

### 1.2 Scope

| Entity Type | Supported | Status Checkbox | ID Fields |
|-------------|-----------|-----------------|-----------|
| Individual | ✅ | Individual | Aadhaar |
| Sole Proprietorship | ✅ | Proprietorship Firm | Aadhaar |
| Partnership Firm | ✅ | Partnership Firm | None |
| Pvt Ltd | ✅ | Private Ltd Company | DIN |
| LLP | ✅ | Others: LLP | DPIN |
| OPC | ✅ | Private Ltd Company | DIN |

### 1.3 Workflow Position

```
KYC Complete → Bank Verified → References Collected → Documents Verified
                                                            ↓
                                                   [PDF GENERATION] ← YOU ARE HERE
                                                            ↓
                                                       E-Stamp API
                                                            ↓
                                                       E-Sign API
                                                            ↓
                                                      ✓ Onboarded
```

### 1.4 Key Files

| File | Path | Purpose |
|------|------|---------|
| Entry Point | `pdf-agreement-service/src/index.js` | Main export |
| PDF Generator | `pdf-agreement-service/src/services/pdfGenerator.js` | Core logic |
| Coordinates | `pdf-agreement-service/src/config/coordinates.js` | Field positions |
| Constants | `pdf-agreement-service/src/config/constants.js` | Entity types |
| Mappers | `pdf-agreement-service/src/mappers/*.js` | Data transformers |

---

## 2. Prerequisites

### 2.1 Dependencies

```bash
# Already installed in pdf-agreement-service
npm install pdf-lib joi
```

### 2.2 Required Files

- `templates/DSA_Agreement_blank.pdf` - The blank DSA Agreement template

### 2.3 Data Requirements

Before calling PDF generation, ensure:

| Entity | Required Data |
|--------|--------------|
| All | `entityType`, `phone`, `email`, `references[]` |
| Individual | `kyc.aadhaar`, `kyc.pan`, `livenessImage` |
| Sole Prop | Above + `businessAddress` |
| Partnership | `firmName`, `firmPan`, `partners[]`, `businessAddress` |
| Company | `companyName`, `companyPan`, `directors[]`, `registeredAddress` |

---

## 3. Installation

### 3.1 Copy Module to Project

```bash
# From your project root
cp -r /path/to/pdf-agreement-service ./src/services/pdf-agreement-service

# OR if using as sibling directory
# Keep it as is and import relatively
```

### 3.2 Recommended Structure

```
dsa-onboarding/
├── src/
│   ├── services/
│   │   ├── pdf-agreement-service/    ← Place here
│   │   │   ├── src/
│   │   │   │   ├── index.js
│   │   │   │   ├── config/
│   │   │   │   ├── mappers/
│   │   │   │   └── services/
│   │   │   └── templates/
│   │   ├── sandboxApi.js
│   │   └── signdeskApi.js
│   ├── routes/
│   │   └── agreement.js              ← Use here
│   └── models/
│       └── Application.js
```

### 3.3 Verify Installation

```bash
cd src/services/pdf-agreement-service
npm test
# Should generate 5 PDFs in tests/output/
```

---

## 4. Architecture

### 4.1 Module Structure

```
pdf-agreement-service/
├── src/
│   ├── index.js                 ← Main export
│   ├── config/
│   │   ├── constants.js         ← ENTITY_TYPES, FONT_CONFIG
│   │   └── coordinates.js       ← All PDF field coordinates
│   ├── mappers/
│   │   ├── individual.js        ← Individual data mapper
│   │   ├── proprietorship.js    ← Sole Prop data mapper
│   │   ├── partnership.js       ← Partnership data mapper
│   │   └── company.js           ← Pvt Ltd/LLP/OPC mapper
│   └── services/
│       └── pdfGenerator.js      ← Core PDF generation
└── templates/
    └── DSA_Agreement_blank.pdf  ← Template file
```

### 4.2 Data Flow

```
Application Model → Entity Mapper → Mapped Data → PDF Generator → PDF Buffer
        ↓                ↓              ↓               ↓             ↓
   (MongoDB)     (Transforms      (Uniform       (Fills pages)  (Ready for
                  entity-         structure)                     E-Stamp)
                  specific
                  data)
```

### 4.3 Export API

```javascript
const { 
    generateAgreementPDF,    // Main function
    ENTITY_TYPES,            // Entity constants
    COMPANY_SUB_TYPES,       // Pvt Ltd, LLP, OPC
    mappers                  // Individual mapper functions
} = require('./pdf-agreement-service/src');
```

---

## 5. Entity-Specific Integration

### 5.1 Individual Workflow

**When to Call:** After KYC complete, bank verified, references collected

**Required Data:**
```javascript
const application = {
    entityType: 'individual',
    phone: '9876543210',
    email: 'user@email.com',
    kyc: {
        aadhaar: {
            verified: true,
            maskedNumber: '988877665544',
            data: {
                name: 'RAJESH KUMAR',
                dob: '1990-05-15',
                address: 'Full residential address here'
            }
        },
        pan: {
            verified: true,
            number: 'ABCDE1234F'
        }
    },
    livenessImage: 'base64_of_face_matched_selfie',
    references: [
        { name: 'Person 1', mobile: '9876543211', email: 'p1@email.com', address: 'Address 1' },
        { name: 'Person 2', mobile: '9876543212', email: 'p2@email.com', address: 'Address 2' }
    ]
};
```

**PDF Output:**
- Page 1: Name, Age, PAN, Aadhaar, Residential Address ✅
- Page 9: Email ✅
- Page 12: Witness names (from references) ✅
- Page 17: Photo, Name, Aadhaar, ✓Individual, Residential Address, Mobile, Email ✅
- Page 18: References (2 persons) ✅

---

### 5.2 Sole Proprietorship Workflow

**When to Call:** After KYC + documents (Shop Act/Udyam/GST) verified

**Required Data:**
```javascript
const application = {
    entityType: 'proprietorship',
    phone: '9876543210',
    email: 'business@email.com',
    kyc: {
        aadhaar: { /* same as individual */ },
        pan: { /* same as individual */ }
    },
    businessAddress: 'Shop No. 5, Commercial Complex, City - 123456',
    livenessImage: 'base64_selfie',
    references: [ /* same structure */ ]
};
```

**PDF Output:**
- Page 1: Name, Age, PAN, Aadhaar, Residential Address ✅
- Page 17: ✓Proprietorship Firm checkbox ✅
- Page 18: Business Address section filled ✅

---

### 5.3 Partnership Firm Workflow

**When to Call:** After all partners KYC + documents verified

**Required Data:**
```javascript
const application = {
    entityType: 'partnership',
    firmName: 'M/S SHARMA & ASSOCIATES',
    firmPan: 'AABFS1234A',
    phone: '9876543210',
    email: 'firm@email.com',
    businessAddress: 'Office address here',
    livenessImage: 'signatory_partner_selfie',
    partners: [
        {
            name: 'PARTNER 1',
            mobile: '9876543211',
            email: 'p1@firm.com',
            isSignatory: true,
            kyc: {
                aadhaar: { data: { address: 'Partner 1 address' } }
            }
        },
        {
            name: 'PARTNER 2',
            mobile: '9876543212',
            email: 'p2@firm.com',
            isSignatory: false,
            kyc: {
                aadhaar: { data: { address: 'Partner 2 address' } }
            }
        }
    ]
};
```

**PDF Output:**
- Page 1: Firm Name, Firm PAN, Business Address (Age/Aadhaar blank) ✅
- Page 12: Partner names as witnesses ✅
- Page 17: ✓Partnership Firm, Signatory photo ✅
- Page 18: Partners details ✅

---

### 5.4 Pvt Ltd / OPC Workflow

**When to Call:** After MCA verification + directors KYC + documents verified

**Required Data:**
```javascript
const application = {
    entityType: 'company',
    companySubType: 'pvt_ltd',  // or 'opc'
    companyName: 'TECH SOLUTIONS PRIVATE LIMITED',
    companyPan: 'AABCT1234C',
    phone: '9876543210',
    email: 'company@email.com',
    registeredAddress: 'Registered office address',
    livenessImage: 'signatory_director_selfie',
    directors: [
        {
            name: 'DIRECTOR 1',
            din: '12345678',
            mobile: '9876543211',
            email: 'd1@company.com',
            isSignatory: true,
            kyc: {
                aadhaar: { data: { address: 'Director 1 address' } }
            }
        },
        {
            name: 'DIRECTOR 2',
            din: '87654321',
            mobile: '9876543212',
            email: 'd2@company.com',
            isSignatory: false,
            kyc: {
                aadhaar: { data: { address: 'Director 2 address' } }
            }
        }
    ]
};
```

**PDF Output:**
- Page 1: Company Name, Company PAN, Registered Address (Age/Aadhaar blank) ✅
- Page 17: ✓Private Ltd Company, DIN filled ✅
- Page 18: Directors details ✅

---

### 5.5 LLP Workflow

**When to Call:** After MCA verification + designated partners KYC + documents verified

**Required Data:**
```javascript
const application = {
    entityType: 'company',
    companySubType: 'llp',
    companyName: 'CONSULTING PARTNERS LLP',
    companyPan: 'AABCL1234L',
    phone: '9876543210',
    email: 'llp@email.com',
    registeredAddress: 'Registered office address',
    livenessImage: 'signatory_partner_selfie',
    directors: [  // Note: LLP uses directors array for partners
        {
            name: 'DESIGNATED PARTNER 1',
            dpin: '11112222',  // DPIN instead of DIN
            mobile: '9876543211',
            email: 'dp1@llp.com',
            isSignatory: true,
            kyc: {
                aadhaar: { data: { address: 'Partner 1 address' } }
            }
        },
        {
            name: 'DESIGNATED PARTNER 2',
            dpin: '33334444',
            mobile: '9876543212',
            email: 'dp2@llp.com',
            isSignatory: false,
            kyc: {
                aadhaar: { data: { address: 'Partner 2 address' } }
            }
        }
    ]
};
```

**PDF Output:**
- Page 1: LLP Name, LLP PAN, Registered Address (Age/Aadhaar blank) ✅
- Page 17: ✓Others checked, "LLP" written, DPIN filled ✅
- Page 18: Designated Partners details ✅

---

## 6. Data Mapping Reference

### 6.1 Application Model → PDF Field Mapping

| PDF Field | Individual | Sole Prop | Partnership | Pvt Ltd/OPC | LLP |
|-----------|------------|-----------|-------------|-------------|-----|
| **P1: Date** | Current date | Current date | Current date | Current date | Current date |
| **P1: Name** | kyc.aadhaar.data.name | kyc.aadhaar.data.name | firmName | companyName | companyName |
| **P1: Age** | Calculated from DOB | Calculated from DOB | *(blank)* | *(blank)* | *(blank)* |
| **P1: PAN** | kyc.pan.number | kyc.pan.number | firmPan | companyPan | companyPan |
| **P1: Aadhaar** | kyc.aadhaar.maskedNumber | kyc.aadhaar.maskedNumber | *(blank)* | *(blank)* | *(blank)* |
| **P1: Address** | kyc.aadhaar.data.address | kyc.aadhaar.data.address | businessAddress | registeredAddress | registeredAddress |
| **P9: Email** | email | email | email | email | email |
| **P12: Witness 1** | references[0].name | references[0].name | partners[0].name | directors[0].name | directors[0].name |
| **P12: Witness 2** | references[1].name | references[1].name | partners[1].name | directors[1].name | directors[1].name |
| **P17: Photo** | livenessImage | livenessImage | signatory.faceMatchImage | signatory.faceMatchImage | signatory.faceMatchImage |
| **P17: Aadhaar** | kyc.aadhaar.maskedNumber | kyc.aadhaar.maskedNumber | *(blank)* | *(blank)* | *(blank)* |
| **P17: DIN** | *(blank)* | *(blank)* | *(blank)* | signatory.din | *(blank)* |
| **P17: DPIN** | *(blank)* | *(blank)* | *(blank)* | *(blank)* | signatory.dpin |
| **P17: Checkbox** | Individual | Proprietorship | Partnership | Private Ltd | Others: LLP |
| **P17: Res. Addr** | Address + Mobile + Email | *(blank)* | *(blank)* | *(blank)* | *(blank)* |
| **P18: Bus. Addr** | *(blank)* | businessAddress | businessAddress | registeredAddress | registeredAddress |
| **P18: Bus. Mobile** | *(blank)* | phone | phone | phone | phone |
| **P18: Person 1** | references[0] | references[0] | partners[0] | directors[0] | directors[0] |
| **P18: Person 2** | references[1] | references[1] | partners[1] | directors[1] | directors[1] |

---

## 7. API Endpoints

### 7.1 Recommended Route Structure

```javascript
// src/routes/agreement.js

const express = require('express');
const router = express.Router();
const { generateAgreementPDF } = require('../services/pdf-agreement-service/src');
const Application = require('../models/Application');

/**
 * POST /api/agreement/generate-pdf
 * Generate filled DSA Agreement PDF from Application data
 */
router.post('/generate-pdf', async (req, res) => {
    try {
        const { applicationId } = req.body;
        
        // Fetch application with all populated data
        const application = await Application.findById(applicationId)
            .populate('kyc')
            .lean();
        
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        // Generate PDF
        const pdfBuffer = await generateAgreementPDF(application);
        
        // Option 1: Return base64
        res.json({
            success: true,
            pdfBase64: pdfBuffer.toString('base64'),
            contentType: 'application/pdf'
        });
        
        // Option 2: Return as download
        // res.setHeader('Content-Type', 'application/pdf');
        // res.setHeader('Content-Disposition', `attachment; filename=DSA-Agreement-${applicationId}.pdf`);
        // res.send(pdfBuffer);
        
    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

/**
 * POST /api/agreement/generate-and-stamp
 * Generate PDF and immediately send to E-Stamp
 */
router.post('/generate-and-stamp', async (req, res) => {
    try {
        const { applicationId } = req.body;
        const application = await Application.findById(applicationId).lean();
        
        // Step 1: Generate PDF
        const pdfBuffer = await generateAgreementPDF(application);
        const pdfBase64 = pdfBuffer.toString('base64');
        
        // Step 2: Send to E-Stamp API
        const stampResult = await signdeskApi.estamp({
            document_content: pdfBase64,
            document_category: 147,
            // ... other stamp params
        });
        
        // Update application with stamp ID
        await Application.findByIdAndUpdate(applicationId, {
            'agreement.estampId': stampResult.request_id,
            'agreement.documentUrl': stampResult.stamped_document_url,
            status: 'estamp'
        });
        
        res.json({
            success: true,
            estampId: stampResult.request_id,
            nextStep: 'esign'
        });
        
    } catch (error) {
        console.error('Generate and stamp error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
```

### 7.2 Usage in Frontend

```javascript
// In app.js or workflow logic

async function generateAgreement(applicationId) {
    showLoader('Generating Agreement...');
    
    try {
        const response = await fetch('/api/agreement/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Option A: Show preview
            const pdfBlob = base64ToBlob(result.pdfBase64, 'application/pdf');
            displayPDFPreview(pdfBlob);
            
            // Option B: Proceed to E-Stamp directly
            proceedToEStamp(applicationId);
        }
    } catch (error) {
        showError('Failed to generate agreement');
    }
}
```

---

## 8. Workflow Integration Points

### 8.1 Individual Workflow

```
Step 1: Entity Selection ─────────────────────────────────── No PDF action
Step 2: Phone OTP Login ──────────────────────────────────── No PDF action
Step 3: KYC (DigiLocker/Manual + Liveness + Face Match) ──── Collect: name, aadhaar, pan, address, selfie
Step 4: Bank Verification ────────────────────────────────── No PDF action
Step 5: References (2 persons) ───────────────────────────── Collect: references[]
Step 6: Generate Agreement ───────────────────────────────── ⭐ CALL generateAgreementPDF()
Step 7: E-Stamp ──────────────────────────────────────────── Pass PDF buffer
Step 8: E-Sign ───────────────────────────────────────────── Pass stamped PDF
Step 9: Complete ─────────────────────────────────────────── Store final document
```

### 8.2 Sole Proprietorship Workflow

```
Step 1-4: Same as Individual
Step 5: References (2 persons)
Step 6: Document Submission (Shop Act, Udyam, GST) ───────── Collect: businessAddress
Step 7: Generate Agreement ───────────────────────────────── ⭐ CALL generateAgreementPDF()
Step 8-10: E-Stamp, E-Sign, Complete
```

### 8.3 Partnership Workflow

```
Step 1: Entity Selection
Step 2: Phone OTP Login
Step 3: Add Partners ─────────────────────────────────────── Collect: partners[]
Step 4: Select Signatory Partner
Step 5: Signatory Full KYC ───────────────────────────────── Collect: signatory selfie
Step 6: Other Partners Basic KYC
Step 7: Bank Verification
Step 8: References (same partners or new)
Step 9: Document Submission ──────────────────────────────── Collect: businessAddress, firmPan
Step 10: Generate Agreement ──────────────────────────────── ⭐ CALL generateAgreementPDF()
Step 11-13: E-Stamp, E-Sign, Complete
```

### 8.4 Company Workflow (Pvt Ltd / LLP / OPC)

```
Step 1: Entity Selection
Step 2: Phone OTP Login
Step 3: Company Verification (CIN/LLPIN via MCA) ─────────── Collect: companyName, registeredAddress
Step 4: Import Directors/Designated Partners ─────────────── Collect: directors[]
Step 5: Select Signatory Director
Step 6: Signatory Full KYC ───────────────────────────────── Collect: signatory selfie, DIN/DPIN
Step 7: Other Directors Basic KYC
Step 8: Bank Verification
Step 9: References (same directors or new)
Step 10: Document Submission ─────────────────────────────── Collect: companyPan
Step 11: Generate Agreement ──────────────────────────────── ⭐ CALL generateAgreementPDF()
Step 12-14: E-Stamp, E-Sign, Complete
```

---

## 9. Error Handling

### 9.1 Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Unknown entity type` | Invalid `entityType` value | Use `ENTITY_TYPES.INDIVIDUAL`, etc. |
| `Template not found` | PDF template missing | Ensure `templates/DSA_Agreement_blank.pdf` exists |
| `Image embed error` | Invalid base64 image | Validate image format (PNG/JPG) |
| `Page index out of range` | Wrong page coordinate | Check `pageIndex` in coordinates.js |

### 9.2 Validation Before Generation

```javascript
function validateBeforeGeneration(application) {
    const errors = [];
    
    if (!application.entityType) {
        errors.push('entityType is required');
    }
    
    if (!application.email) {
        errors.push('email is required');
    }
    
    // Entity-specific validations
    if (application.entityType === 'individual') {
        if (!application.kyc?.aadhaar?.data?.name) {
            errors.push('Aadhaar KYC required for Individual');
        }
    }
    
    if (['partnership', 'company'].includes(application.entityType)) {
        const persons = application.partners || application.directors || [];
        if (persons.length < 2) {
            errors.push('At least 2 partners/directors required');
        }
    }
    
    return errors;
}
```

---

## 10. Testing

### 10.1 Run All Tests

```bash
cd pdf-agreement-service
npm test
```

### 10.2 Test Individual Entity

```javascript
const { generateAgreementPDF, ENTITY_TYPES } = require('./src');

const testApp = {
    entityType: ENTITY_TYPES.INDIVIDUAL,
    phone: '9876543210',
    email: 'test@test.com',
    kyc: {
        aadhaar: {
            maskedNumber: '123412341234',
            data: { name: 'TEST USER', dob: '1990-01-01', address: 'Test Address' }
        },
        pan: { number: 'ABCDE1234F' }
    },
    references: [
        { name: 'Ref 1', mobile: '1111111111', email: 'r1@test.com', address: 'Addr 1' },
        { name: 'Ref 2', mobile: '2222222222', email: 'r2@test.com', address: 'Addr 2' }
    ]
};

const pdf = await generateAgreementPDF(testApp);
fs.writeFileSync('test-output.pdf', pdf);
```

### 10.3 Integration Test with Real Application

```javascript
// In your test file
const Application = require('../models/Application');
const { generateAgreementPDF } = require('../services/pdf-agreement-service/src');

describe('PDF Generation', () => {
    it('should generate PDF for completed Individual application', async () => {
        const app = await Application.findOne({ 
            entityType: 'individual', 
            status: 'references' 
        }).lean();
        
        const pdfBuffer = await generateAgreementPDF(app);
        expect(pdfBuffer).toBeInstanceOf(Buffer);
        expect(pdfBuffer.length).toBeGreaterThan(100000);
    });
});
```

---

## 11. Troubleshooting

### 11.1 PDF Not Generated

**Check:**
1. Template file exists: `ls templates/DSA_Agreement_blank.pdf`
2. Dependencies installed: `npm list pdf-lib`
3. Entity type is valid: Use constants from `ENTITY_TYPES`

### 11.2 Fields Not Populated

**Check:**
1. Data structure matches expected format
2. Nested paths exist (e.g., `kyc.aadhaar.data.name`)
3. Entity mapper is returning correct fields

**Debug:**
```javascript
const { mappers } = require('./pdf-agreement-service/src');
const mapped = mappers.mapIndividualData(application);
console.log('Mapped data:', JSON.stringify(mapped, null, 2));
```

### 11.3 Image Not Embedded

**Check:**
1. Image is valid base64 (PNG or JPG)
2. No line breaks in base64 string
3. Image size is reasonable (< 1MB recommended)

**Test:**
```javascript
const imageBase64 = application.livenessImage;
const buffer = Buffer.from(imageBase64, 'base64');
console.log('Image size:', buffer.length, 'bytes');
```

### 11.4 Coordinates Misaligned

**Solution:**
1. Generate coordinate guide: `node pdf-agreement-service/tests/generate-coordinate-guide.js`
2. Open guide PDF and identify correct X, Y values
3. Update `src/config/coordinates.js`

---

## 12. Coordinate Configuration

### 12.1 Current Coordinates

All coordinates are in `src/config/coordinates.js`. They were verified by the user and should NOT be modified without re-verification.

### 12.2 Coordinate Reference

| Page | Field | X | Y |
|------|-------|---|---|
| 1 | date | 480 | 645 |
| 1 | name | 88 | 290 |
| 1 | age | 272 | 290 |
| 1 | pan | 475 | 290 |
| 1 | aadhaar | 127 | 275 |
| 1 | address | 70 | 255 |
| 9 | email | 321 | 196 |
| 12 | witness1 | 83 | 505 |
| 12 | witness2 | 83 | 443 |
| 17 | photo | 420 | 580 (100x110) |
| 17 | name | 80 | 622 |
| 17 | aadhaar | 223 | 580 |
| 17 | din | 202 | 560 |
| 17 | dpin | 180 | 538 |
| 17 | checkbox_individual | 150 | 452 |
| 17 | checkbox_proprietorship | 293 | 452 |
| 17 | checkbox_partnership | 411 | 452 |
| 17 | checkbox_privateLtd | 193 | 410 |
| 17 | checkbox_others | 200 | 367 |
| 17 | residential_address | 80 | 306/283 |
| 17 | mobile | 340 | 240 |
| 17 | email | 160 | 200 |
| 18 | business_address | 80 | 710/687 |
| 18 | business_mobile | 370 | 665 |
| 18 | person1_name | 180 | 580 |
| 18 | person1_mobile | 140 | 560 |
| 18 | person1_email | 321 | 560 |
| 18 | person1_address | 180 | 521/499 |
| 18 | person2_name | 180 | 460 |
| 18 | person2_mobile | 180 | 435 |
| 18 | person2_email | 350 | 435 |
| 18 | person2_address | 180 | 395/370 |

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                 PDF GENERATION QUICK REF                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  IMPORT:                                                     │
│  const { generateAgreementPDF } = require('./pdf-service'); │
│                                                              │
│  CALL:                                                       │
│  const pdf = await generateAgreementPDF(application);       │
│                                                              │
│  ENTITY TYPES:                                               │
│  • 'individual'                                              │
│  • 'proprietorship'                                          │
│  • 'partnership'                                             │
│  • 'company' + companySubType: 'pvt_ltd'|'llp'|'opc'        │
│                                                              │
│  REQUIRED FIELDS (ALL):                                      │
│  • entityType, phone, email                                  │
│  • references[] OR partners[] OR directors[]                 │
│  • livenessImage (for photo)                                 │
│                                                              │
│  CALL AFTER:                                                 │
│  • KYC complete                                              │
│  • Bank verified                                             │
│  • References/Partners collected                             │
│  • Documents verified (for non-Individual)                   │
│                                                              │
│  NEXT STEP:                                                  │
│  Pass PDF buffer to E-Stamp API                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-28  
**Module Version:** pdf-agreement-service@1.0.0
