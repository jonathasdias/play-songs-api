require('dotenv').config();
const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const app = express();
const port = process.env.PORT || 3001;

// Certificar-se de que o diretório de uploads existe
const uploadDir = path.join(__dirname, 'uploads');
if (!fsSync.existsSync(uploadDir)) {
  fsSync.mkdirSync(uploadDir);
}

app.use(cors());
app.use(express.json());

// Conectar ao banco de dados
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Testar a conexão ao banco de dados
db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar no banco de dados:', err);
    process.exit(1);
  }
  console.log('Conectado ao banco de dados com sucesso!');
});

const upload = multer({
  dest: uploadDir,
});

// Upload de músicas
app.post('/api/upload', upload.array('audio'), async (req, res) => {
  if (!req.files?.length) return res.status(400).send('Nenhum arquivo enviado.');

  try {
    for (const file of req.files) {
      const buffer = await fs.readFile(file.path);

      // Inserir no banco
      await db.promise().execute('INSERT INTO songs (name, fileData) VALUES (?, ?)', [
        file.originalname,
        buffer,
      ]);

      // Excluir o arquivo depois de salvar no banco
      await fs.unlink(file.path);
    }
    res.status(200).send('Músicas salvas com sucesso!');
  } catch (err) {
    console.error('Erro ao salvar músicas:', err);
    res.status(500).send('Erro ao salvar músicas.');
  }
});

// Listagem de músicas
app.get('/api/songs', async (req, res) => {
  try {
    const [rows] = await db.promise().execute('SELECT id, name FROM songs');
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar músicas:', err);
    res.status(500).send('Erro ao buscar músicas.');
  }
});

// Stream por ID
app.get('/api/audio/:id', async (req, res) => {
  try {
    const [rows] = await db.promise().execute('SELECT name, fileData FROM songs WHERE id = ?', [req.params.id]);

    if (!rows.length) return res.status(404).send('Música não encontrada.');

    const song = rows[0];

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="${song.name}"`);
    res.send(song.fileData);
  } catch (err) {
    console.error('Erro ao carregar música:', err);
    res.status(500).send('Erro ao carregar música.');
  }
});

// Deletar música
app.delete('/api/songs/:id', async (req, res) => {
  try {
    const [result] = await db.promise().execute('DELETE FROM songs WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).send('Música não encontrada.');
    }

    res.status(200).send('Música deletada com sucesso!');
  } catch (err) {
    console.error('Erro ao deletar música:', err);
    res.status(500).send('Erro ao deletar música.');
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});