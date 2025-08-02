const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();

app.use(express.json());
app.use(cors())

const generalController = require('./controllers/GeneralController');
app.use('/api', generalController);

const apiPort = process.env.PORT
app.listen(apiPort, () => console.log(`Levantando API en http://localhost:${apiPort}`));