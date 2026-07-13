const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World! My Docker container is running!');
});

app.listen(port, () => {
  console.log(`App running and listening on port ${port}`);
});