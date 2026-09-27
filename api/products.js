export default async function handler(req, res) {
  const { offset } = req.query;
  const baseId = 'app8CqLGTAPaDZc5n'; 
  // Usamos o ID direto da Tabela extraído da URL do seu Airtable:
  const tableName = 'tbliURvEyK3SCGhWe'; 
  const token = process.env.AIRTABLE_TOKEN;

  if (!token) {
    return res.status(500).json({ erro: 'TOKEN_NAO_ENCONTRADO' });
  }

  let url = `https://api.airtable.com/v0/\({baseId}/\){tableName}`;
  if (offset) url += `?offset=${offset}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token.trim()}` }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        erro: 'MENSAGEM_DO_AIRTABLE',
        statusAirtable: response.status,
        detalheAirtable: data
      });
    }

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=59');
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ erro: 'FALHA_NA_CONEXAO', detalhe: error.message });
  }
}