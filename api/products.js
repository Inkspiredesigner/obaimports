export default async function handler(req, res) {
  const { offset } = req.query;
  const baseId = 'app8CqLGTAPaDZc5n'; // ID fixo da base Oba Imports
  const tableName = 'Produtos';
  const token = process.env.AIRTABLE_TOKEN;

  // 1. Diagnóstico: Verifica se a variável existe na Vercel
  if (!token) {
    return res.status(500).json({
      erro: 'TOKEN_NAO_ENCONTRADO',
      mensagem: 'A variável AIRTABLE_TOKEN não está configurada no painel da Vercel para este projeto.'
    });
  }

  let url = `https://api.airtable.com/v0/\({baseId}/\){encodeURIComponent(tableName)}`;
  if (offset) url += `?offset=${offset}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token.trim()}` }
    });

    const data = await response.json();

    // 2. Diagnóstico: Se o Airtable recusar
    if (!response.ok) {
      return res.status(response.status).json({
        erro: 'MENSAGEM_DO_AIRTABLE',
        statusAirtable: response.status,
        detalheAirtable: data
      });
    }

    // Sucesso!
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=59');
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ erro: 'FALHA_NA_CONEXAO', detalhe: error.message });
  }
}