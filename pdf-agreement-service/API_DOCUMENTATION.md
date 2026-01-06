# PDF Agreement Service - API Reference

This document provides the complete API reference for the `pdf-agreement-service` library. This module is designed to be imported into a Node.js backend (DSA Onboarding Platform) to generate entity-specific DSA Agreements.

## 1. Installation & Usage

### 1.1 Import
```javascript
const { 
    generateAgreementPDF, 
    ENTITY_TYPES, 
    COMPANY_SUB_TYPES 
} = require('./path/to/pdf-agreement-service/src');
```

### 1.2 Basic Example
```javascript
try {
    const pdfBuffer = await generateAgreementPDF(applicationData);
    // pdfBuffer is a standard Node.js Buffer containing the binary PDF data
    
    // Example: Sending to client
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
} catch (error) {
    console.error('PDF Generation Failed:', error.message);
}
```

---

## 2. Exports

The module exports the following members:

| Member | Type | Description |
|--------|------|-------------|
| `generateAgreementPDF` | `Function` | **Primary API**. Generates a PDF buffer from a raw application model. |
| `generatePDFFromMappedData` | `Function` | Low-level API. Generates PDF from pre-mapped internal data structure. |
| `ENTITY_TYPES` | `Object` | Constants for entity types: `INDIVIDUAL`, `PROPRIETORSHIP`, `PARTNERSHIP`, `COMPANY`. |
| `COMPANY_SUB_TYPES` | `Object` | Constants for company sub-types: `PVT_LTD`, `OPC`, `LLP`, `PUBLIC_LTD`. |
| `mappers` | `Object` | Access to internal mapper functions (`mapIndividualData`, etc.). |

---

## 3. Main Function: `generateAgreementPDF`

Automatically selects the correct data mapper based on the `entityType` property in the input object and generates the filled PDF.

### Signature
```javascript
async generateAgreementPDF(application) -> Promise<Buffer>
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `application` | `Object` | Yes | The application data object. Structure depends on `entityType`. |

### Return Value
*   **Type**: `Promise<Buffer>`
*   **Description**: A Node.js Buffer containing the complete, binary PDF file ready for saving or transmission.

### Throws
*   `Error`: If `entityType` is missing or invalid.
*   `Error`: If required fields (like names or dates) are missing in the input.
*   `Error`: If the PDF template file cannot be found.
*   `Error`: If image embedding fails (e.g., invalid base64).

---

## 4. Input Data Models (Application Object)

The structure of the `application` object passed to `generateAgreementPDF` changes based on the `entityType`. Note that for **non-individual** entities, certain fields like addresses and PANs are expected to be nested within a `business` or `company` object to align with the internal mapper logic.

### 4.1 Common Fields (All Entities)
Every application object **must** contain these fields:

```javascript
{
    "entityType": "individual" | "proprietorship" | "partnership" | "company",
    "phone": "9876543210",          // Primary contact mobile
    "email": "user@example.com",    // Primary contact email
    
    // Array of references (Witnesses in PDF)
    "references": [
        {
            "name": "Ref Name 1",
            "mobile": "9876543211",
            "email": "ref1@email.com",
            "address": "Full address string..."
        },
        {
            "name": "Ref Name 2",
            "mobile": "9876543212",
            "email": "ref2@email.com",
            "address": "Full address string..."
        }
    ]
}
```

### 4.2 Individual Entity
**`entityType`: 'individual'**

Requires `kyc` object with Aadhaar and PAN details.

```javascript
{
    "entityType": "individual",
    // ... Common Fields ...
    
    "livenessImage": "base64_string...", // User's selfie (Face Match)
    
    "kyc": {
        "aadhaar": {
            "maskedNumber": "xxxx-xxxx-1234",
            "data": {
                "name": "Full Name as per Aadhaar",
                "dob": "YYYY-MM-DD",
                "address": "Full residential address from Aadhaar"
            }
        },
        "pan": {
            "number": "ABCDE1234F"
        }
    }
}
```

### 4.3 Sole Proprietorship
**`entityType`: 'proprietorship'**

Similar to Individual but requires a `business` object containing `businessAddress` (or falls back to residential address if missing).

```javascript
{
    "entityType": "proprietorship",
    // ... Common Fields ...
    
    // Key Difference: Business details nested in 'business' object for strict compliance
    "business": {
        "businessAddress": "Shop 1, Market Road, City, State - 400001"
    },
    
    "livenessImage": "base64_string...", // Proprietor's selfie
    
    "kyc": {
        "aadhaar": {
            "maskedNumber": "xxxx-xxxx-1234",
            "data": {
                "name": "Proprietor Name",
                "dob": "YYYY-MM-DD",
                "address": "Residential address"
            }
        },
        "pan": {
            "number": "ABCDE1234F" // Individual PAN of Proprietor
        }
    }
}
```

### 4.4 Partnership Firm
**`entityType`: 'partnership'**

Requires `business` object for firm details and a list of `partners`. One partner must be marked as `isSignatory: true`.

```javascript
{
    "entityType": "partnership",
    // ... Common Fields ...
    
    "firmName": "M/S Example Traders", // Can be at root OR application.name
    
    // Key Difference: Firm PAN and Address nested in 'business' object
    "business": {
        "firmPan": "AAAQF1234F",
        "businessAddress": "Office 101, Business Park, City..."
    },
    
    // Selfie of the authorized signatory partner
    "livenessImage": "base64_string...", 
    
    "partners": [
        {
            "name": "Partner One",
            "mobile": "9898989898",
            "email": "p1@firm.com",
            "isSignatory": true, // THIS partner's details go to signatory page
            "kyc": {
                "aadhaar": {
                    "data": { "address": "Residential addr..." }
                },
                "pan": { "number": "ABC..." }
            }
        },
        {
            "name": "Partner Two",
            "mobile": "9797979797",
            "email": "p2@firm.com",
            "isSignatory": false,
            "kyc": {
                "aadhaar": {
                    "data": { "address": "Residential addr..." }
                },
                "pan": { "number": "XYZ..." }
            }
        }
    ]
}
```

### 4.5 Company (Pvt Ltd / OPC)
**`entityType`: 'company'** with `companySubType`: 'pvt_ltd' or 'opc'

Requires `company` object and `directors` array. One director must be `isSignatory: true`.

```javascript
{
    "entityType": "company",
    "companySubType": "pvt_ltd",
    // ... Common Fields ...
    
    // Key Difference: Company details nested in 'company' object
    "company": {
        "name": "Tech Solutions Pvt Ltd",
        "pan": { "number": "AAACT1234C" },
        "registeredAddress": "Regd Office Address, City...",
        "cin": "U12345MH2023PTC123456", // Optional, for reference
        "dateOfIncorporation": "2023-01-01"
    },
    
    // Selfie of the authorized director
    "livenessImage": "base64_string...",
    
    "directors": [
        {
            "name": "Director One",
            "din": "01234567", // Director Identification Number
            "mobile": "9898989898",
            "email": "d1@company.com",
            "isSignatory": true,
            "kyc": {
                "aadhaar": {
                    "data": { "address": "Residential addr..." }
                },
                "pan": { "number": "ABC..." }
            }
        },
        {
            "name": "Director Two",
            "din": "07654321",
            "mobile": "9797979797",
            "email": "d2@company.com",
            "isSignatory": false,
            "kyc": {
                "aadhaar": {
                    "data": { "address": "Residential addr..." }
                },
                "pan": { "number": "XYZ..." }
            }
        }
    ]
}
```

### 4.6 Limited Liability Partnership (LLP)
**`entityType`: 'company'** with `companySubType`: 'llp'

Uses the same structure as Company (nested in `company` object), but with `dpin` in directors.

```javascript
{
    "entityType": "company",
    "companySubType": "llp",
    // ... Common Fields ...

    "company": {
        "name": "Consulting LLP",
        "pan": { "number": "AAAEL1234L" },
        "registeredAddress": "Regd Office Address...",
        "llpin": "ABC-1234" // Optional
    },
    
    "livenessImage": "base64_string...",
    
    // Use 'directors' array for Designated Partners
    "directors": [
        {
            "name": "Designated Partner 1",
            "dpin": "01234567", // DPIN for LLP partners
            "mobile": "9898989898",
            "email": "dp1@llp.com",
            "isSignatory": true,
            "kyc": {
                "aadhaar": {
                    "data": { "address": "Residential addr..." }
                },
                "pan": { "number": "ABC..." }
            }
        },
        // ... other partners
    ]
}
```

---

## 5. Output PDF Specifications

The generated PDF is based on the `DSA_Agreement_blank.pdf` template.

### Filled Sections
1.  **Page 1 (Execution Date & Parties)**:
    *   Fills Date, Name, Age (if individual), PAN, Aadhaar/Reg No, and Address.
2.  **Page 9 (Notices)**:
    *   Fills the DSA's email address for official notices.
3.  **Page 12 (Witnesses)**:
    *   Fills the names of 2 witnesses (from `references` or `partners`/`directors` list).
4.  **Page 17 (Signatory Details)**:
    *   Embeds the **Passport Photo** (from `livenessImage`).
    *   Fills Applicant Name, Aadhaar, DIN/DPIN.
    *   **Checks the correct box** for Status (Individual, Proprietorship, etc.).
    *   Fills Residential Address, Mobile, and Email of the signatory.
5.  **Page 18 (Business & Reference Details)**:
    *   Fills Business Address and Business Mobile (if non-individual).
    *   Fills detailed contact info for 2 References/Partners/Directors.

---

## 6. Technical Notes

*   **Images**: The `livenessImage` must be a valid Base64 string (check for `data:image/png;base64,` prefix handling). It supports PNG and JPG.
*   **Fonts**: Uses standard Helvetica font.
*   **Coordinates**: Field positions are hardcoded in `src/config/coordinates.js`.
*   **Template**: Uses `src/templates/DSA_Agreement_blank.pdf`. If this file is moved, the service will fail.
