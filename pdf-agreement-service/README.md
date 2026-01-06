# PDF Agreement Service

Entity-specific DSA Agreement PDF generation for DSA Onboarding Platform v3.0.

## Installation

```bash
npm install
```

## Usage

```javascript
const { generateAgreementPDF, ENTITY_TYPES } = require('./src');

// From v3.0 Application model
const pdfBuffer = await generateAgreementPDF(applicationData);

// Save or send to E-Stamp
fs.writeFileSync('agreement.pdf', pdfBuffer);
```

## Entity Types

- `individual` - Single person DSA
- `proprietorship` - Sole Proprietorship
- `partnership` - Partnership Firm
- `company` - Pvt Ltd / LLP / OPC

## Structure

```
pdf-agreement-service/
├── src/
│   ├── config/
│   │   ├── constants.js    # Entity types, font config
│   │   └── coordinates.js  # PDF field coordinates
│   ├── mappers/            # Entity data transformers
│   ├── services/
│   │   └── pdfGenerator.js # Core PDF logic
│   └── index.js            # Main export
├── templates/
│   └── DSA_Agreement_blank.pdf
└── tests/
    └── test-all-entities.js
```

## Testing

```bash
npm test
```

Generates PDFs for all entity types in `tests/output/`.

## Integration

Import into main DSA Platform:

```javascript
// In routes/agreement.js
const { generateAgreementPDF } = require('../pdf-agreement-service/src');

router.post('/generate-pdf', async (req, res) => {
    const application = await Application.findById(req.body.applicationId);
    const pdfBuffer = await generateAgreementPDF(application);
    
    res.json({ pdfBase64: pdfBuffer.toString('base64') });
});
```
