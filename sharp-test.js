try {
  const sharp = require('sharp');
  console.log('Sharp loaded successfully! Version:', sharp.versions);
} catch (err) {
  console.error('Error loading sharp directly:', err);
  process.exit(1); // Exit with error code if sharp fails to load
}

console.log('Script finished.'); 