export default async function handler(req, res) {
  const { offset } = req.query;
  // ID fixo e direto da base Oba Imports
  const baseId = 'app8CqLGTAPaDZc5n'; 
  const tableName = 'Produtos';
  const token = process.env.AIRTABLE_TOKEN;

  let url = `https://api.airtable.com/v0/\({baseId}/\){encodeURIComponent(tableName)}`;
  if (offset) url += `?offset=${offset}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();

    // Se o Airtable retornar erro, não guarda em cache
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    // Cache na Vercel por 15 minutos apenas para requisições com sucesso (200 OK)
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=59');

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao conectar com o servidor' });
  }
}