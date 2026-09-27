export default async function handler(req, res) {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;

  const { offset } = req.query;

  // Apontando para a tabela "Produtos"
  let airtableUrl = `https://api.airtable.com/v0/${baseId}/Produtos`;
  if (offset) {
    airtableUrl += `?offset=${encodeURIComponent(offset)}`;
  }

  try {
    const response = await fetch(airtableUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Erro Airtable: ${response.status}`);
    }

    const data = await response.json();

    // ADICIONADO: Diz à Vercel para guardar o resultado em cache durante 1 hora (3600 segundos)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar dados do Airtable' });
  }
}