const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mime = require("mime-types");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(cors());

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Cad29167#2442",
  database: "almacenamiento",
});

db.connect((err) => {
  if (err) {
    console.error("Error al conectar a la base de datos:", err);
  } else {
    console.log("Conexión a la base de datos establecida");
  }
});

db.on("error", (err) => {
  console.error("Error en la conexión a la base de datos:", err);
});

app.use("/planos", express.static(path.join(__dirname, "archivos")));

/* const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "planos"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
}); */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "archivos"));
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

app.get("/api/archivos", (req, res) => {
  const query = "SELECT * FROM archivos";
  db.query(query, (err, result) => {
    if (err) {
      console.error("Error al obtener los archivos:", err);
      res.status(500).json({ error: "Error al obtener los archivos" });
    } else {
      console.log(result);
      res.json(result);
    }
  });
});

/* app.get("/api/archivos/:nombre", (req, res) => {
  const { nombre } = req.params;
  const rutaArchivo = path.join(__dirname, "planos", nombre);

  fs.readFile(rutaArchivo, (err, data) => {
    if (err) {
      console.error("Error al leer el archivo:", err);
      res.status(500).json({ error: "Error al leer el archivo" });
    } else {
      res.send(data);
    }
  });
}); */

app.get("/api/archivos/:nombre", (req, res) => {
  const { nombre } = req.params;
  const rutaArchivo = path.join(__dirname, "archivos", nombre);
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");

  fs.readFile(rutaArchivo, (err, data) => {
    if (err) {
      console.error("Error al leer el archivo:", err);
      res.status(500).json({ error: "Error al leer el archivo" });
    } else {
      const mimeType = mime.lookup(nombre);
      console.log("MIME Type:", mimeType);
      if (!mimeType) {
        console.error("Tipo de archivo desconocido:", nombre);
        res.status(500).json({ error: "Tipo de archivo desconocido" });
      } else {
        res.set("Content-Type", mimeType);
        res.send(data);
      }
    }
  });
});

app.post("/api/archivos", upload.single("archivo"), (req, res) => {
  const tipo = req.file.mimetype;
  const { nombre } = req.body;
  const disciplina = req.body.disciplina;
  const modificado = new Date();
  const tamanoBytes = req.file.size;
  const archivo = req.file.filename;

  function formatSize(sizeInBytes) {
    if (sizeInBytes < 1024) {
      return sizeInBytes + " bytes";
    } else if (sizeInBytes < 1024 * 1024) {
      return (sizeInBytes / 1024).toFixed(2) + " KB";
    } else if (sizeInBytes < 1024 * 1024 * 1024) {
      return (sizeInBytes / (1024 * 1024)).toFixed(2) + " MB";
    } else {
      return (sizeInBytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
    }
  }

  const tamano = formatSize(tamanoBytes);

  const query =
    "INSERT INTO archivos (tipo, nombre, disciplina, modificado, tamano, archivo) VALUES (?, ?, ?, ?, ?, ?)";
  db.query(
    query,
    [tipo, nombre, disciplina, modificado, tamano, archivo],
    (err, result) => {
      if (err) {
        console.error("Error al agregar el plano:", err);
        res.status(400).json({ error: "Error al agregar el plano" });
      } else {
        console.log("Plano agregado correctamente:", result);
        res.json({ message: "Plano agregado correctamente" });
      }
    }
  );
});

app.delete("/api/archivos/:id", (req, res) => {
  const { id } = req.params;

  // Primero, consulta la información del plano que se va a eliminar para obtener el nombre del archivo asociado.
  const selectQuery = "SELECT archivo FROM archivos WHERE id = ?";
  db.query(selectQuery, [id], (selectErr, selectResult) => {
    if (selectErr) {
      console.error("Error al obtener el plano para eliminar:", selectErr);
      res
        .status(500)
        .json({ error: "Error al obtener el plano para eliminar" });
    } else {
      if (selectResult.length === 0) {
        // Si no se encuentra el plano con el id proporcionado, responde con un error.
        res.status(404).json({ error: "Plano no encontrado" });
        return;
      }

      const archivo = selectResult[0].archivo;

      // Ahora, procede a eliminar el plano de la base de datos.
      const deleteQuery = "DELETE FROM archivos WHERE id = ?";
      db.query(deleteQuery, [id], (deleteErr, deleteResult) => {
        if (deleteErr) {
          console.error("Error al eliminar el plano:", deleteErr);
          res.status(500).json({ error: "Error al eliminar el plano" });
        } else {
          console.log("Plano eliminado correctamente:", deleteResult);

          // Finalmente, elimina el archivo físicamente del directorio de planos.
          const rutaArchivo = path.join(__dirname, "archivos", archivo);
          fs.unlink(rutaArchivo, (unlinkErr) => {
            if (unlinkErr) {
              console.error("Error al eliminar el archivo:", unlinkErr);
            } else {
              console.log("Archivo eliminado correctamente");
            }
          });

          res.json({ message: "Plano eliminado correctamente" });
        }
      });
    }
  });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  const encryptedPassword = crypto
    .createHash("md5")
    .update(password)
    .digest("hex");

  const query = "SELECT * FROM usuarios WHERE usuario = ? AND contrasena = ?";
  db.query(query, [username, encryptedPassword], (err, result) => {
    if (err) {
      console.error("Error al consultar la base de datos:", err);
      res.status(500).json({ error: "Error al consultar la base de datos" });
    } else {
      if (result.length === 0) {
        res.status(401).json({ error: "Credenciales inválidas" });
      } else {
        res.json({ message: "Inicio de sesión exitoso", user: result[0] });
      }
    }
  });
});

app.get("/api/archivos/lista", (req, res) => {
  const query = "SELECT archivo FROM archivos";
  db.query(query, (err, result) => {
    if (err) {
      console.error("Error al obtener la lista de archivos:", err);
      res.status(500).json({ error: "Error al obtener la lista de archivos" });
    } else {
      const archivos = result.map((row) => row.archivo);
      res.json({ archivos });
    }
  });
});

app.get("/api/archivos/disciplina/:disciplina", (req, res) => {
  const { disciplina } = req.params;

  const query = "SELECT * FROM archivos WHERE disciplina = ?";
  db.query(query, [disciplina], (err, result) => {
    if (err) {
      console.error("Error al obtener los planos por disciplina:", err);
      res
        .status(500)
        .json({ error: "Error al obtener los planos por disciplina" });
    } else {
      console.log(result);
      res.json(result);
    }
  });
});

app.get("/api/categorias", (req, res) => {
  const query = "SELECT nombre FROM disciplina";
  db.query(query, (err, result) => {
    if (err) {
      console.error("Error al obtener las disciplinas:", err);
      res.status(500).json({ error: "Error al obtener las disciplinas" });
    } else {
      const disciplinas = result.map((row) => row.nombre);
      res.json({ disciplinas });
    }
  });
});

/* app.get("/api/archivos/cantidad-por-disciplina", (req, res) => {
  const query =
    "SELECT disciplina, COUNT(*) as cantidad FROM archivos GROUP BY disciplina";
  db.query(query, (err, result) => {
    if (err) {
      console.error(
        "Error al obtener la cantidad de archivos por disciplina:",
        err
      );
      res.status(500).json({
        error: "Error al obtener la cantidad de archivos por disciplina",
      });
    } else {
      const archivosPorDisciplina = {};
      result.forEach((row) => {
        archivosPorDisciplina[row.disciplina] = row.cantidad;
      });
      res.json({ archivosPorDisciplina });
      console.log(archivosPorDisciplina);
    }
  });
}); */

app.post("/api/validarclave", (req, res) => {
  const { clave } = req.body;

  const query = "SELECT * FROM acceso WHERE clave = ?";
  db.query(query, [clave], (err, result) => {
    if (err) {
      console.error("Error al consultar la base de datos:", err);
      res.status(500).json({ error: "Error al consultar la base de datos" });
    } else {
      if (result.length === 0) {
        res.status(401).json({ error: "Clave inválida" });
      } else {
        res.json({ message: "Clave válida", user: result[0] });
      }
    }
  });
});

app.get("/api/documents", (req, res) => {
  const query = "SELECT * FROM archivos";
  db.query(query, (err, result) => {
    if (err) {
      console.error("Error al obtener los archivos:", err);
      res.status(500).json({ error: "Error al obtener los archivos" });
    } else {
      const documents = result.map((row) => {
        console.log(row.archivo);
        const documentURI = `https://api-almacenamiento.in/api/archivos/${encodeURIComponent(
          row.archivo
        )}`;
        return { uri: documentURI };
      });
      res.json(documents);
    }
  });
});

const port = 8081;
app.listen(port, () => {
  console.log(`Servidor iniciado en el puerto ${port}`);
});
