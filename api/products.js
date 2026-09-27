export default async function handler(req, res) {
  // 1. Configura o cache da Vercel (5 minutos)
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  const { offset } = req.query;
  const baseId = 'appBCqLGTAPaDZc5n';
  const tableName = 'Produtos';
  const token = process.env.AIRTABLE_TOKEN;

  // Verificação de segurança: token ausente
  if (!token) {
    return res.status(500).json({ 
      error: 'Variável AIRTABLE_TOKEN não configurada no painel da Vercel.' 
    });
  }

  let url = `https://api.airtable.com/v0/\({baseId}/\){encodeURIComponent(tableName)}`;
  if (offset) url += `?offset=${offset}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao conectar com o Airtable' });
  }
}