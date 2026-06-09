const pdf = require('pdf-parse');
console.log('Type of pdf-parse export:', typeof pdf);
console.log('Keys of pdf-parse export:', Object.keys(pdf));
if (typeof pdf !== 'function' && pdf.default) {
  console.log('Type of pdf.default:', typeof pdf.default);
}
