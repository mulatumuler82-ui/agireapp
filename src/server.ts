import app from './app';
import { config } from './config';

app.listen(config.port, '0.0.0.0', () => {
  console.log(`AgriConnect API running on http://localhost:${config.port}`);
  console.log(`API docs:               http://localhost:${config.port}/api/docs`);
});
