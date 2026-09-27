export default function handler(req, res) {
  // Configuração para carregar instantaneamente
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  // Retorna os produtos direto do código (Substitua a lista abaixo pelos seus produtos reais)
  return res.status(200).json({
    "records": [
      {
        "id": "rec01",
        "fields": {
          "Nome": "Perfume Exemplo 1",
          "Categoria": "50ml",
          "Status 2": "Disponivel",
          "imagem": "https://via.placeholder.com/300"
        }
      },
      {
        "id": "rec02",
        "fields": {
          "Nome": "Perfume Exemplo 2",
          "Categoria": "100ml",
          "Status 2": "Disponivel",
          "imagem": "https://via.placeholder.com/300"
        }
      }
    ]
  });
}