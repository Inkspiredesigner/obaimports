export default async function handler(req, res) {
  const { offset } = req.query;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = 'Produtos';
  const token = process.env.AIRTABLE_TOKEN;

  let url = `https://api.airtable.com/v0/\({baseId}/\){encodeURIComponent(tableName)}`;
  if (offset) url += `?offset=${offset}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();

    // Se o Airtable retornar um erro (ex: token inválido ou limite excedido),
    // retorna o erro correto sem salvar em cache
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    // Define cache na Vercel por 15 minutos (900 segundos).
    // As visitas durante esse tempo lerão a memória da Vercel sem gastar o limite do Airtable.
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=59');

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao conectar com o servidor' });
  }
}