import {calculatePrice} from './pricing.mjs';
import {loadArtwork} from './static-store.mjs';

const MAX_FILES = 6;
const MAX_BODY_BYTES = 7.5 * 1024 * 1024;

export async function submitStaticOrder({fields, cart, config, lang}) {
  if (['localhost', '127.0.0.1'].includes(location.hostname)) throw new Error('local-preview');

  const ids = [...new Set(cart.flatMap(item => item.kind === 'custom'
    ? item.design.layers.filter(layer => layer.type === 'image').map(layer => layer.imageId)
    : []))];
  if (ids.length > MAX_FILES) throw new Error('too-many-files');

  const files = await Promise.all(ids.map(loadArtwork));
  if (files.some(file => !file)) throw new Error('missing-file');
  const reference = 'PR-' + Date.now().toString(36).toUpperCase();
  const estimatedTotal = cart.reduce((total, item) => total + (item.kind === 'custom'
    ? calculatePrice(item.design, config).total
    : config.prices.models[item.modelId] * item.quantity), 0);
  const items = cart.map(item => item.kind === 'custom'
    ? {
      kind: 'custom', product: item.design.product, size: item.design.size,
      color: item.design.color, quantity: item.design.quantity,
      layers: item.design.layers.map(layer => ({
        type: layer.type, side: layer.side, x: layer.x, y: layer.y,
        width: layer.width, height: layer.height, rotation: layer.rotation,
        ...(layer.type === 'text'
          ? {text: layer.text, color: layer.color}
          : {artworkField: 'artwork_' + (ids.indexOf(layer.imageId) + 1)})
      }))
    }
    : {kind: 'model', modelId: item.modelId, size: item.size,
      color: item.color, quantity: item.quantity});
  const summary = JSON.stringify({reference, lang, estimatedTotal, priceStatus: config.prices.demo ? 'demo' : 'configured', items});
  const fileBytes = files.reduce((total, file) => total + file.size, 0);
  if (fileBytes + new Blob([summary]).size + 10000 > MAX_BODY_BYTES) throw new Error('files-too-large');

  const body = new FormData();
  body.set('form-name', 'printio-order');
  body.set('bot-field', '');
  body.set('reference', reference);
  body.set('name', String(fields.get('name') || '').trim());
  body.set('phone', String(fields.get('phone') || '').trim());
  body.set('method', String(fields.get('method') || 'message'));
  body.set('notes', String(fields.get('notes') || ''));
  body.set('lang', lang);
  body.set('estimated_total', String(estimatedTotal));
  body.set('order_summary', summary);
  files.forEach((file, index) => body.set('artwork_' + (index + 1), file, file.name || `artwork-${index + 1}.png`));
  const response = await fetch('/', {method: 'POST', body});
  if (!response.ok) throw new Error('netlify-submit-failed');
  return reference;
}
