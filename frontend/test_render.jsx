import React from 'react';
import { renderToString } from 'react-dom/server';
import Dashboard from './src/pages/Dashboard.jsx';

try {
  const html = renderToString(<Dashboard />);
  console.log('Successfully rendered. Length:', html.length);
} catch (e) {
  console.error('RENDER ERROR:', e);
}
