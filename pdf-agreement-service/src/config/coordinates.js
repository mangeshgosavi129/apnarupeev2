/**
 * PDF Field Coordinates Configuration
 * 
 * All coordinates are in PDF points (1 point = 1/72 inch)
 * PDF coordinate system: origin (0,0) is at bottom-left
 * Page size: 612 x 792 points (US Letter)
 * 
 * COORDINATES VERIFIED BY USER - DO NOT MODIFY WITHOUT USER INPUT
 */

const COORDINATES = {
    // ═══════════════════════════════════════════════════════════════════════
    // PAGE 1 - PARTY DETAILS
    // ═══════════════════════════════════════════════════════════════════════
    page1: {
        pageIndex: 0,
        fields: {
            date: { x: 480, y: 645, maxWidth: 100 },
            name: { x: 88, y: 290, maxWidth: 142 },
            age: { x: 272, y: 290, maxWidth: 40 },
            pan: { x: 475, y: 290, maxWidth: 65 },
            aadhaar: { x: 127, y: 275, maxWidth: 113 },
            address_line1: { x: 70, y: 255, maxWidth: 240 }
        }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // PAGE 9 - MAIL ADDRESSES
    // ═══════════════════════════════════════════════════════════════════════
    page9: {
        pageIndex: 8,
        fields: {
            secondPartyEmail: { x: 321, y: 196, maxWidth: 200 }
        }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // PAGE 12 - WITNESSES
    // ═══════════════════════════════════════════════════════════════════════
    page12: {
        pageIndex: 11,
        fields: {
            witness1_name: { x: 83, y: 505, maxWidth: 250 },
            witness2_name: { x: 83, y: 443, maxWidth: 250 }
        }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // PAGE 17 - APPLICATION FORM
    // ═══════════════════════════════════════════════════════════════════════
    page17: {
        pageIndex: 16,
        fields: {
            // Photo
            passportPhoto: { x: 420, y: 580, width: 120, height: 110 },

            // Applicant details
            applicantName: { x: 80, y: 622, maxWidth: 300 },
            applicantName_line2: { x: 80, y: 607, maxWidth: 350 },

            // ID numbers
            aadhaarNo: { x: 223, y: 580, maxWidth: 150 },
            dinNo: { x: 202, y: 560, maxWidth: 120 },
            dpinNo: { x: 180, y: 538, maxWidth: 120 },

            // Status checkboxes
            status: {
                individual: { x: 150, y: 452 },
                proprietorship: { x: 293, y: 452 },
                partnership: { x: 411, y: 452 },
                privateLtd: { x: 193, y: 410 },
                others: { x: 200, y: 367 }
            },
            othersSpecify: { x: 220, y: 367, maxWidth: 200 },

            // Residential address (Individual only)
            residentialAddress_line1: { x: 80, y: 306, maxWidth: 450 },
            residentialAddress_line2: { x: 80, y: 283, maxWidth: 450 },
            residentialMobileNo: { x: 340, y: 240, maxWidth: 150 },
            residentialEmailAddress: { x: 160, y: 200, maxWidth: 280 }
        }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // PAGE 18 - BUSINESS ADDRESS + RELATIVES/DIRECTORS/PARTNERS
    // ═══════════════════════════════════════════════════════════════════════
    page18: {
        pageIndex: 17,
        fields: {
            // Business address (non-Individual entities)
            businessAddress_line1: { x: 80, y: 710, maxWidth: 450 },
            businessAddress_line2: { x: 80, y: 687, maxWidth: 450 },
            businessMobileNo: { x: 370, y: 665, maxWidth: 150 },

            // Person 1 (Relative/Partner/Director)
            person1: {
                name: { x: 180, y: 580, maxWidth: 280 },
                mobile: { x: 140, y: 560, maxWidth: 150 },
                email: { x: 321, y: 560, maxWidth: 180 },
                address_line1: { x: 180, y: 521, maxWidth: 380 },
                address_line2: { x: 180, y: 499, maxWidth: 380 }
            },

            // Person 2 (Relative/Partner/Director)
            person2: {
                name: { x: 180, y: 460, maxWidth: 280 },
                mobile: { x: 180, y: 435, maxWidth: 150 },
                email: { x: 350, y: 435, maxWidth: 180 },
                address_line1: { x: 180, y: 395, maxWidth: 380 },
                address_line2: { x: 180, y: 370, maxWidth: 380 }
            }
        }
    }
};

module.exports = { COORDINATES };
