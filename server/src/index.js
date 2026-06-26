import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 80);

createApp().listen(port, () => {
  console.log(`fitness API listening on ${port}`);
});
