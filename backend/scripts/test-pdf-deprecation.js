const PDFDocument = require('pdfkit');
const doc = new PDFDocument();

doc.on('data', (chunk) => {});
doc.on('end', () => { console.log('PDF ended'); process.exit(0); });
doc.on('error', (err) => { console.error('PDF error', err); process.exit(1); });

doc.text('Test');
doc.end();
