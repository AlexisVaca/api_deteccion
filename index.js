const express = require('express');
const bodyParser = require('body-parser');
const pool = require('./db');
const axios = require('axios')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const upload = multer({dest: 'uploads/'});
const secretKey = process.env.JWT_SECRET_KEY;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(bodyParser.json());

/* TOKEN */
function verificarToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1]; // Obtener el token del encabezado Authorization

    if (!token) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }

    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Token inválido' });
        }
        // Si el token es válido, se puede almacenar la información del usuario en req.user para su uso posterior
        req.user = decoded;
        next();
    });
}

/*Endpoint de detección de objetos */
app.post('/api/detect', upload.single('image'), async (req, res) => {
    try {
        const imagePath = req.file.path;
        const formData = new FormData();
        formData.append('image', fs.createReadStream(imagePath));

        const response = await axios.post('https://deteccion-especie.onrender.com/detect', formData, {
            headers: {
                ...formData.getHeaders()
            }
        });

        res.json(response.data);
    } catch (err) {
        console.error('Error al procesar la imagen', err);
        res.status(500).json({ error: 'Error al procesar la imagen' });
    }
});

/* ESPECIES */
//GET Retorna todas las especies registradas en la base de datos.
//Ruta: /api/especies
app.get('/api/especies', verificarToken, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM especies');
        res.json(rows);
    } catch (err) {
        console.error('Error al obtener especies', err);
        res.status(500).json({ error: 'Error al obtener especies' });
    }
});

//POST Crea una nueva especie en la base de datos.
//Ruta: /api/especies
app.post('/api/especies', async (req, res) => {
    const { nombre_cientifico, nombre_comun, descripcion, estado_conservacion, habitat } = req.body;
    try {
        const { rows } = await pool.query('INSERT INTO especies (nombre_cientifico, nombre_comun, descripcion, estado_conservacion, habitat) VALUES ($1, $2, $3, $4, $5) RETURNING *', [nombre_cientifico, nombre_comun, descripcion, estado_conservacion, habitat]);
        res.json(rows[0]);
    } catch (err) {
        console.error('Error al crear especie', err);
        res.status(500).json({ error: 'Error al crear especie' });
    }
});

//PUT Actualiza los detalles de una especie específica.
//Ruta: /api/especies/:id
app.put('/api/especies/:id', async (req, res) => {
    const especieId = req.params.id;
    const { nombre_cientifico, nombre_comun, descripcion, estado_conservacion, habitat } = req.body;
    try {
        const { rows } = await pool.query('UPDATE especies SET nombre_cientifico = $1, nombre_comun = $2, descripcion = $3, estado_conservacion = $4, habitat = $5 WHERE id = $6 RETURNING *', [nombre_cientifico, nombre_comun, descripcion, estado_conservacion, habitat, especieId]);
        res.json(rows[0]);
    } catch (err) {
        console.error(`Error al actualizar especie con ID ${especieId}`, err);
        res.status(500).json({ error: `Error al actualizar especie con ID ${especieId}` });
    }
});

//DELETE Elimina una especie específica de la base de datos.
//Ruta: /api/especies/:id
app.delete('/api/especies/:id', async (req, res) => {
    const especieId = req.params.id;
    try {
        await pool.query('DELETE FROM especies WHERE id = $1', [especieId]);
        res.json({ message: 'Especie eliminada correctamente' });
    } catch (err) {
        console.error(`Error al eliminar especie con ID ${especieId}`, err);
        res.status(500).json({ error: `Error al eliminar especie con ID ${especieId}` });
    }
});

/* USUARIOS */
//GET Retorna todos los usuarios registrados en la base de datos.
//Ruta: /api/usuarios
app.get('/api/usuarios', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, nombre, email, fecha_registro FROM usuarios');
        res.json(rows);
    } catch (err) {
        console.error('Error al obtener usuarios', err);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

//LOGIN
app.post('/api/login', async (req, res) => {
    const { email, contraseña } = req.body;
    try {
        const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (rows.length === 0) {
            return res.status(400).json({ error: 'Usuario no encontrado' });
        }

        const usuario = rows[0];
        const contraseñaValida = await bcrypt.compare(contraseña, usuario.contraseña);
        console.log(contraseña);
        console.log(usuario.contraseña);
        console.log(contraseñaValida);
        if (!contraseñaValida) {
            return res.status(400).json({ error: 'Contraseña incorrecta'});
        }

        const token = jwt.sign({ id: usuario.id, email: usuario.email }, secretKey, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        console.error('Error al iniciar sesión', err);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

//POST Crea un nuevo usuario en la base de datos.
//Ruta: /api/usuarios
app.post('/api/usuarios', async (req, res) => {
    const { nombre, email, contraseña } = req.body;
    try {
        const { rows } = await pool.query('INSERT INTO usuarios (nombre, email, contraseña) VALUES ($1, $2, $3) RETURNING id, nombre, email, fecha_registro', [nombre, email, contraseña]);
        res.json(rows[0]);
    } catch (err) {
        console.error('Error al crear usuario', err);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});


//PUT Actualiza los detalles de un usuario específico.
//Ruta: /api/usuarios/:id
app.put('/api/usuarios/:id', async (req, res) => {
    const usuarioId = req.params.id;
    const { nombre, email, contraseña } = req.body;
    try {
        const { rows } = await pool.query('UPDATE usuarios SET nombre = $1, email = $2, contraseña = $3 WHERE id = $4 RETURNING id, nombre, email, fecha_registro', [nombre, email, contraseña, usuarioId]);
        res.json(rows[0]);
    } catch (err) {
        console.error(`Error al actualizar usuario con ID ${usuarioId}`, err);
        res.status(500).json({ error: `Error al actualizar usuario con ID ${usuarioId}` });
    }
});

//DELETE Elimina un usuario específico de la base de datos.
//Ruta: /api/usuarios/:id
app.delete('/api/usuarios/:id', async (req, res) => {
    const usuarioId = req.params.id;
    try {
        await pool.query('DELETE FROM usuarios WHERE id = $1', [usuarioId]);
        res.json({ message: 'Usuario eliminado correctamente' });
    } catch (err) {
        console.error(`Error al eliminar usuario con ID ${usuarioId}`, err);
        res.status(500).json({ error: `Error al eliminar usuario con ID ${usuarioId}` });
    }
});


/* AVISTAMIENTOS */
//GET Retorna todos los avistamientos registrados en la base de datos.
//Ruta: /api/avistamientos
app.get('/api/avistamientos', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM avistamientos');
        res.json(rows);
    } catch (err) {
        console.error('Error al obtener avistamientos', err);
        res.status(500).json({ error: 'Error al obtener avistamientos' });
    }
});

//POST Crea un nuevo avistamiento en la base de datos.
//Ruta: /api/avistamientos
app.post('/api/avistamientos', async (req, res) => {
    const { id_especie, id_usuario, fecha_avistamiento, ubicacion, imagen_url, comentarios } = req.body;
    try {
        const { rows } = await pool.query('INSERT INTO avistamientos (id_especie, id_usuario, fecha_avistamiento, ubicacion, imagen_url, comentarios) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [id_especie, id_usuario, fecha_avistamiento, ubicacion, imagen_url, comentarios]);
        res.json(rows[0]);
    } catch (err) {
        console.error('Error al crear avistamiento', err);
        res.status(500).json({ error: 'Error al crear avistamiento' });
    }
});

//PUT Actualiza los detalles de un avistamiento específico.
//Ruta: /api/avistamientos/:id
app.put('/api/avistamientos/:id', async (req, res) => {
    const avistamientoId = req.params.id;
    const { id_especie, id_usuario, fecha_avistamiento, ubicacion, imagen_url, comentarios } = req.body;
    try {
        const { rows } = await pool.query('UPDATE avistamientos SET id_especie = $1, id_usuario = $2, fecha_avistamiento = $3, ubicacion = $4, imagen_url = $5, comentarios = $6 WHERE id = $7 RETURNING *', [id_especie, id_usuario, fecha_avistamiento, ubicacion, imagen_url, comentarios, avistamientoId]);
        res.json(rows[0]);
    } catch (err) {
        console.error(`Error al actualizar avistamiento con ID ${avistamientoId}`, err);
        res.status(500).json({ error: `Error al actualizar avistamiento con ID ${avistamientoId}` });
    }
});

//DELETE Elimina un avistamiento específico de la base de datos.
//Ruta: /api/avistamientos/:id
app.delete('/api/avistamientos/:id', async (req, res) => {
    const avistamientoId = req.params.id;
    try {
        await pool.query('DELETE FROM avistamientos WHERE id = $1', [avistamientoId]);
        res.json({ message: 'Avistamiento eliminado correctamente' });
    } catch (err) {
        console.error(`Error al eliminar avistamiento con ID ${avistamientoId}`, err);
        res.status(500).json({ error: `Error al eliminar avistamiento con ID ${avistamientoId}` });
    }
});

/* IMÁGENES */
//GET Retorna todas las imágenes asociadas a un avistamiento específico
//Ruta: /api/avistamientos/:avistamientoId/imagenes
app.get('/api/avistamientos/:avistamientoId/imagenes', async (req, res) => {
    const avistamientoId = req.params.avistamientoId;
    try {
        const { rows } = await pool.query('SELECT * FROM imagenes WHERE id_avistamiento = $1', [avistamientoId]);
        res.json(rows);
    } catch (err) {
        console.error(`Error al obtener imágenes del avistamiento con ID ${avistamientoId}`, err);
        res.status(500).json({ error: `Error al obtener imágenes del avistamiento con ID ${avistamientoId}` });
    }
});

//POST Sube una nueva imagen y la asocia a un avistamiento específico en la base de datos.
//Ruta: /api/avistamientos/:avistamientoId/imagenes
app.post('/api/avistamientos/:avistamientoId/imagenes', async (req, res) => {
    const avistamientoId = req.params.avistamientoId;
    const { url, metadatos } = req.body;
    try {
        const { rows } = await pool.query('INSERT INTO imagenes (id_avistamiento, url, metadatos) VALUES ($1, $2, $3) RETURNING *', [avistamientoId, url, metadatos]);
        res.json(rows[0]);
    } catch (err) {
        console.error(`Error al crear imagen para el avistamiento con ID ${avistamientoId}`, err);
        res.status(500).json({ error: `Error al crear imagen para el avistamiento con ID ${avistamientoId}` });
    }
});


//PUT 
//Ruta: 

//DELETE Elimina una imagen específica asociada a un avistamiento en la base de datos.
//Ruta: /api/avistamientos/:avistamientoId/imagenes/:imagenId
app.delete('/api/avistamientos/:avistamientoId/imagenes/:imagenId', async (req, res) => {
    const { avistamientoId, imagenId } = req.params;
    try {
        await pool.query('DELETE FROM imagenes WHERE id = $1 AND id_avistamiento = $2', [imagenId, avistamientoId]);
        res.json({ message: 'Imagen eliminada correctamente' });
    } catch (err) {
        console.error(`Error al eliminar imagen con ID ${imagenId} del avistamiento con ID ${avistamientoId}`, err);
        res.status(500).json({ error: `Error al eliminar imagen con ID ${imagenId} del avistamiento con ID ${avistamientoId}` });
    }
});

app.get('/', (req, res) => {
    const htmlResponse = `
    <html>
        <head>
        <title>Inicio</title>
        </head>
        <body><h1>Proyecto backend</h1></body>
    </html>
    `;
    res.send(htmlResponse);
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
