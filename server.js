const express = require('express');
const cors = require('cors');
const mediaRoutes = require('./src/routes/mediaRoutes');
const playRoutes = require('./src/routes/playRoutes');
const errorHandler = require('./src/middleware/errorHandler');
const config = require('./src/config');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/v1', mediaRoutes);
app.use('/api/v1', playRoutes);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server berjalan di http://localhost:${config.port}`);
  console.log(`Endpoint: GET http://localhost:${config.port}/api/v1/media/:fileId`);
  console.log(`Endpoint: GET http://localhost:${config.port}/api/v1/play/:driveId`);
});
