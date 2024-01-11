import express from "express";
//express => para criar a api e fazer as requisições
import jwt from "jsonwebtoken";
// jwt=> gerar token
import bcrypt from "bcrypt";
//bcrypt => pq não se salva senha de usuario como plain text
import fs from "fs";
// fs=> pacote do node que permite que a gente ler e escrever em aquivos ex: db.json
import cors from "cors";
// cors => para conseguir fazer a requisição
const app = express();
//servidor para criar as reque post, get, delete
const port = 3000;
const privateKey = "galodelutaehmeuovo";
import dayjs from "dayjs";
import db from "./connect.js";
//privateKey para gerar o token e verificar. palavra secreta
app.use(express.json());
app.use(cors());

app.get("/", async (req, res) => {
  const usuarios = await db.db.query("SELECT * FROM usuarios");
  res.send(usuarios[0]);
});

app.post("/cadastro", async (req, res) => {
  const senha = req.body.senha;
  const email = req.body.email;
  const hashSenha = bcrypt.hashSync(senha, 12);
  const [resultado] = await db.db.query(
    "SELECT * FROM usuarios WHERE email=?",
    [email]
  );
  // const data = JSON.parse(fs.readFileSync("./db.json", "utf8"));
  // const usuarioExiste = !!data.usuario.find((u) => u.email === email);
  const [usuarioExiste] = resultado;
  console.log(usuarioExiste);
  if (usuarioExiste) {
    return res.status(409).send({ message: "usuário já cadastrado" });
  }
  const sql = `INSERT INTO usuarios(nome, email, senha) VALUES ('${req.body.nome}', '${email}', '${hashSenha}')`;

  const [result, fields] = await db.db.query({ sql });
  // const idUsuario = data.usuario.length + 1;
  // const usuario = { ...req.body, senha: hashSenha, id: idUsuario };
  // data.usuario.push(usuario);
  // fs.writeFileSync("./db.json", JSON.stringify(data));
  res.status(201).send(result);
});

app.post("/login", (req, res) => {
  const email = req.body?.email;
  const senha = req.body?.senha;
  if (!email || !senha) {
    return res.status(401).send({ message: "payload inválido" });
  }
  const data = JSON.parse(fs.readFileSync("./db.json", "utf8"));

  const usuario = data.usuario.find((user) => user.email === email);
  if (!usuario)
    return res.status(401).send({ message: "usuario ou senha inválida" });

  const senhaCerta = bcrypt.compareSync(senha, usuario.senha);
  if (!senhaCerta) {
    return res.status(401).send({ message: "usuario ou senha inválida" });
  }
  const token = jwt.sign(
    { email, id: usuario.id, nome: usuario.nome },
    privateKey,
    {
      expiresIn: "7d",
    }
  );

  res.send({ token, username: usuario.nome });
});

app.post("/tarefas", (req, res) => {
  req.headers;
  const bearerToken = req.headers.authorization;
  const token = bearerToken.replace("Bearer ", "");
  if (!token) return res.status(401);
  const decoded = jwt.verify(token, privateKey);

  console.log(decoded);
  const { tarefa, fim, inicio, descricao } = req.body;

  if (!tarefa || !fim || !inicio || !descricao) {
    return res.status(400).send({ message: "payload inválido" });
  }
  const data = JSON.parse(fs.readFileSync("./db.json", "utf8"));

  const tarefas = data.tarefas.filter(
    (tarefa) => tarefa.usuarioId === decoded.id && !tarefa.estaDeletado
  );
  const teste2 = tarefas.map(() => {
    return tarefa.fim === decoded.id;
  });

  const novaTarefa = {
    tarefa,
    inicio,
    fim,
    descricao,
    status: "Em andamento",
    estaDeletado: false,
    usuarioId: decoded.id,
    id: data.tarefas.length + 1,
  };

  data.tarefas.push(novaTarefa);

  fs.writeFileSync("./db.json", JSON.stringify(data));
  //  fs.writeFileSync ele vai enviar os dados para o db.json
  res.status(201).send(novaTarefa);
});

app.get("/tarefas", (req, res) => {
  const bearerToken = req.headers.authorization;
  const token = bearerToken.replace("Bearer ", "");
  if (!token) return res.status(401);
  const decoded = jwt.verify(token, privateKey);

  const data = JSON.parse(fs.readFileSync("./db.json", "utf8"));

  const tarefas = data.tarefas.filter(
    (tarefa) => tarefa.usuarioId === decoded.id && !tarefa.estaDeletado
  );

  res.status(200).send(tarefas);
});

app.get("/tarefas-atraso", (req, res) => {
  const data = JSON.parse(fs.readFileSync("./db.json", "utf8"));
  const dataAtual = new Date().toISOString();

  const tarefas = data.tarefas.map((t) => {
    const dataDif = (t.fim - dataAtual) / (1000 * 60 * 60 * 24);
    if (t.status === "Realizada") {
      return t;
    } else if (t.fim > dataAtual && dataDif < 1) {
      return { ...t, status: "Pendente" };
    } else if (t.fim > dataAtual) {
      return { ...t, status: "Em andamento" };
    } else {
      return { ...t, status: "Em atraso" };
    }
  });
  data.tarefas = tarefas;
  fs.writeFileSync("./db.json", JSON.stringify(data));
  res.send(tarefas.filter((t) => t.status === "Em atraso"));

  // console.log(dataFim, "vasco");
});

app.delete("/tarefas/:id", (req, res) => {
  const bearerToken = req.headers.authorization;
  const token = bearerToken.replace("Bearer ", "");
  if (!token) return res.status(401);
  const decoded = jwt.verify(token, privateKey);
  const tarefaId = Number(req.params.id);
  const data = JSON.parse(fs.readFileSync("./db.json", "utf8"));
  const tarefa = data.tarefas.find(
    (tarefa) =>
      tarefa.id === tarefaId &&
      tarefa.usuarioId === decoded.id &&
      !tarefa.estaDeletado
  );

  if (!tarefa) {
    return res.status(404).send({ message: "Tarefa não existe" });
  }
  const tarefas = data.tarefas.map((tarefa) => {
    if (tarefaId === tarefa.id) {
      return {
        ...tarefa,
        estaDeletado: true,
      };
    }
    return tarefa;
  });

  data.tarefas = tarefas;
  fs.writeFileSync("./db.json", JSON.stringify(data));
  res.status(200).send();
});

app.put("/tarefas/:id", (req, res) => {
  const bearerToken = req.headers.authorization;
  const token = bearerToken.replace("Bearer ", "");
  if (!token) return res.status(401);
  const decoded = jwt.verify(token, privateKey);

  const { tarefa, fim, inicio, descricao, status } = req.body;
  if (!tarefa || !fim || !inicio || !descricao || !status) {
    return res.status(400).send({ message: "payload inválido" });
  }
  const tarefaId = Number(req.params.id);
  const data = JSON.parse(fs.readFileSync("./db.json", "utf8"));
  const tarefaModificada = data.tarefas.find(
    (tarefa) =>
      tarefa.id === tarefaId &&
      tarefa.usuarioId === decoded.id &&
      !tarefa.estaDeletado
  );

  if (!tarefaModificada) {
    return res.status(404).send({ message: "Tarefa não existe" });
  }

  const tarefas = data.tarefas.map((t) => {
    if (tarefaId === t.id) {
      return {
        ...t,
        tarefa,
        fim,
        inicio,
        descricao,
        status,
      };
    }
    return t;
  });

  data.tarefas = tarefas;
  fs.writeFileSync("./db.json", JSON.stringify(data));
  res.status(200).send();
});

app.listen(port, () => {
  console.log(`Server ouvindo na porta ${port}`);
});
