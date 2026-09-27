import productsData from './products.json';

export default function handler(req, res) {
  // Define o cache para o navegador carregar rápido
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  
  // Retorna os produtos diretamente do ficheiro local
  return res.status(200).json(productsData);
}