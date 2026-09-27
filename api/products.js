export default async function handler(req, res) {
  const { offset } = req.query;
  const baseId = 'appBCqLGTAPaDZc5n';
  const tableName = 'Produtos';
  const token = process.env.AIRTABLE_TOKEN;

  let url = `https://api.airtable.com/v0/\({baseId}/\){encodeURIComponent(tableName)}`;
  if (offset) url += `?offset=${offset}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();

    // Se o Airtable retornar um erro, envia o erro original sem salvar em cache
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    // Aplica o cache na Vercel por 5 minutos (300s) apenas para respostas com sucesso
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao conectar com o servidor' });
  }
}