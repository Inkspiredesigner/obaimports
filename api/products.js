export default function handler(req, res) {
  // Define o cache para carregar instantaneamente
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  return res.status(200).json({
    "records": [
      {
        "id": "rec01",
        "fields": {
          "Nome": "Perfume Teste 50ml",
          "Categoria": "50ml",
          "Preco": 150,
          "Status 2": "Disponivel",
          "imagem": [{ "url": "https://via.placeholder.com/300" }]
        }
      },
      {
        "id": "rec02",
        "fields": {
          "Nome": "Perfume Teste 100ml",
          "Categoria": "100ml",
          "Preco": 250,
          "Status 2": "Disponivel",
          "imagem": [{ "url": "https://via.placeholder.com/300" }]
        }
      }
    ]
  });
}