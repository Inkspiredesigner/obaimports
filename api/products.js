// Usamos require em vez de import para nao dar erro de modulo no Node
const productsData = require('./products.json');

export default function handler(req, res) {
  try {
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(productsData);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}