export default async function handler(req, res) {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  
  // Captura o offset enviado pelo front-end
  const { offset } = req.query;
  
  // Monta a URL do Airtable repassando o offset se ele existir
  let airtableUrl = `https://api.airtable.com/v0/${baseId}/Perfumes`;
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
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar dados do Airtable' });
  }
}
