/** Calculator unic, folosit de browser și de server. Valorile vin din public/config/prices.json. */
export function calculatePrice(design, config) {
  const {prices, areas} = config;
  const base = prices.base[design.product];
  if (!Number.isFinite(base)) throw new Error('Produs necunoscut');
  let text = 0, image = 0;
  for (const layer of design.layers) {
    const zone = areas[design.product]?.[layer.side];
    if (!zone) throw new Error('Latură necunoscută');
    const widthCm = layer.width * zone.widthCm / 100;
    const heightCm = layer.height * zone.heightCm / 100;
    if (layer.type === 'text' && layer.text.trim()) {
      const band = prices.text.sizeBands.find(b => Math.max(widthCm, heightCm) <= b.maxCm) ?? prices.text.sizeBands.at(-1);
      text += (prices.text.base + Math.max(0, Math.ceil((layer.text.trim().length - 10) / 10)) * prices.text.perExtraTenCharacters) * band.factor;
    }
    if (layer.type === 'image') image += prices.image.base + widthCm * heightCm * prices.image.perSquareCm;
  }
  const active = design.layers.filter(l => l.type === 'image' || (l.type === 'text' && l.text.trim()));
  const sides = new Set(active.map(l => l.side));
  const rules = prices.difficulty;
  const score = Math.max(0, active.length - 1) * rules.extraLayerPoints
    + Math.max(0, sides.size - 1) * rules.extraSidePoints
    + active.filter(l => l.type === 'image' && l.detail === 'detailed').length * rules.detailedImagePoints
    + active.filter(l => Math.abs(l.rotation) >= rules.rotationThreshold).length * rules.rotationPoints;
  const tier = [...rules.tiers].reverse().find(t => score >= t.minScore) ?? rules.tiers[0];
  const difficultyUnit = active.length ? tier.perUnit : 0;
  const difficultySetup = active.length ? tier.setup : 0;
  const unit = Math.round(base + text + image + difficultyUnit);
  const quantity = design.quantity;
  const discount = [...prices.quantityDiscounts].reverse().find(x => quantity >= x.min)?.percent ?? 0;
  const subtotal = unit * quantity;
  return {base, text:Math.round(text), image:Math.round(image), difficultyLevel:tier.id,
    difficultyScore:score, difficultyUnit, difficultySetup, unit, quantity, discount, subtotal,
    total:Math.round(subtotal * (1 - discount / 100) + difficultySetup)};
}
