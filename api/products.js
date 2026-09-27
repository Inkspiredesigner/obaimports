
export default async function handler(req, res) {
  const { offset } = req.query;
  const baseId = 'appBCqLGTAPaDZc5n';
  const tableName = 'Produtos';
  const token = process.env.AIRTABLE_TOKEN;

  let url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
  if (offset) url += `?offset=${offset}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao conectar com o servidor' });
  }
}