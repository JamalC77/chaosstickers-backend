const express = require('express');

console.log('Attempting to load sharp...');
try {
  const sharp = require('sharp');
  console.log('Sharp loaded successfully in mini-server!');
  console.log('Sharp versions:', sharp.versions);
} catch (err) {
  console.error('ERROR loading sharp in mini-server:', err);
  // Don't exit, let Express try to start anyway but log the error
}

const app = express();
const port = 3002; // Use a different port just in case

app.get('/', (req, res) => {
  res.send('Mini server is running!');
});

app.listen(port, () => {
  console.log(`Mini server listening on port ${port}`);
}); 