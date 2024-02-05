import "dotenv/config";
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
import { port, privateKey, saltRound } from "./constantes.js";
import authMiddleware from "./authMiddleware.js";
import dayjs from "dayjs";
import db from "./connect.js";
//privateKey para gerar o token e verificar. palavra secreta
app.use(express.json());
app.use(cors());

app.get("/", async (req, res) => {
  res.send("Esta API está sendo executada!");
});

app.post("/cadastro", async (req, res) => {
  console.log("CADASTRO:")
  try {
    const { nome, senha, email } = req.body;
    if (!email || !senha || !nome) {
      return res.status(401).send({ message: "payload inválido" });
    }

    const hashSenha = bcrypt.hashSync(senha, saltRound);
    const [resultado] = await db.query(
      "SELECT * FROM usuarios WHERE email=?",
      [email]
    );

    const [usuarioExiste] = resultado;
    if (usuarioExiste) {
      return res.status(409).send({ message: "usuário já cadastrado" });
    }
    const sql = `INSERT INTO usuarios(nome, email, senha) VALUES ('${nome}', '${email}', '${hashSenha}')`;
    await db.query({ sql });

    res.status(201).send({ nome });
  } catch (error) {
    console.error("Erro ao cadastrar:", error);
    res.status(500).send({ message: "Erro interno do servidor" });
  }
});

app.post("/login", async (req, res) => {
  console.log("LOGIN:")

  const { senha, email} = req.body;
  if (!email || !senha) {
    return res.status(401).send({ message: "payload inválido" });
  }

  try {
    const [result] = await db.query("SELECT * FROM usuarios WHERE email=?", [
      email,
    ]);

    const usuario = result[0];

    if (!usuario) {
      return res.status(401).send({ message: "usuário ou senha inválida" });
    }

    const senhaCerta = bcrypt.compareSync(senha, usuario.senha);
    if (!senhaCerta) {
      return res.status(401).send({ message: "usuário ou senha inválida" });
    }

    const token = jwt.sign(
      { email, id: usuario.id, nome: usuario.nome },
      privateKey,
      {
        expiresIn: "7d",
      }
    );

    res.send({ token, username: usuario.nome });
  } catch (error) {
    console.error("Erro ao realizar login:", error);
    res.status(500).send({ message: "Erro interno do servidor" });
  }
});

app.post("/tarefas", authMiddleware, async (req, res) => {
  console.log("CRIAR_TAREFA:")
  try {
    const decoded = res.locals.user;

    const { tarefa, fim, inicio, descricao } = req.body;

    if (!tarefa || !fim || !inicio || !descricao) {
      return res.status(400).send({ message: "payload inválido" });
    }

    const novaTarefa = {
      tarefa,
      descricao,
      inicio,
      fim,
      estaDeletado: false,
      usuarioId: decoded.id,
      status: "Em andamento",
    };

    const [result] = await db.query("INSERT INTO tarefas SET ?", [novaTarefa]);

    novaTarefa.id = result.insertId;

    res.status(201).send(novaTarefa);
  } catch (error) {
    console.error("Erro ao criar tarefa:", error);
    res.status(500).send({ message: "Erro interno do servidor" });
  }
});

app.get("/tarefas", authMiddleware, async (req, res) => {
  console.log("LISTAR_TAREFAS:")
  try {
    const decoded = res.locals.user;
    const [result] = await db.query(
      "SELECT * FROM tarefas WHERE usuarioId=? AND estaDeletado=0",
      [decoded.id]
    );
    
    const tarefas = result.map(r => ({
      id: r.id,
      tarefa: r.tarefa,
      descricao: r.descricao,
      inicio: r.inicio,
      fim: r.fim,
      status: r.status,
    }))

    res.status(200).send(tarefas);
  } catch (error) {
    console.error("Erro ao listar tarefas:", error);
    res.status(500).send({ message: "Erro interno do servidor" });
  }
});

app.get("/tarefas-atraso", async (req, res) => {
  console.log("STATUS_TAREFA")
  try {
    const [result] = await db.query("SELECT * FROM tarefas");
    const dataAtual = new Date().toISOString();
    const diaEmMilisegundos = 1000 * 60 * 60 * 24

    const tarefas = result.map((t) => {
      const dataDif = (t.fim - dataAtual) / diaEmMilisegundos;
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

    tarefas.forEach(async tarefa => {
      if(tarefa.status === 'Realizada') return
      await db.query("UPDATE tarefas SET status=? WHERE id=?", [tarefa.status, tarefa.id]);
    })

    res.send(tarefas.filter((t) => t.status === "Em atraso"));
  } catch (error) {
    console.error("Erro ao atualizar status das tarefas:", error);
    res.status(500).send({ message: "Erro interno do servidor" });
  }
});

app.delete("/tarefas/:id", authMiddleware, async (req, res) => {
  console.log("DELETAR_TAREFA:")
  try {
    const decoded = res.locals.user;
    const tarefaId = Number(req.params.id);
    const [result] = await db.query(
      "SELECT * FROM tarefas WHERE id=? AND usuarioId=? AND estaDeletado=0",
      [tarefaId, decoded.id]
    );

    const tarefa = result[0];
    if (!tarefa) {
      return res.status(404).send({ message: "Tarefa não existe" });
    }

    await db.query("UPDATE tarefas SET estaDeletado=1 WHERE id=?", [tarefaId]);
    res.status(200).send();
  } catch (error) {
    console.error("Erro ao deletar tarefas:", error);
    res.status(500).send({ message: "Erro interno do servidor" });
  }
});

app.put("/tarefas/:id", authMiddleware, async (req, res) => {
  console.log("ATUALIZAR_TAREFA:")
  try {
    const decoded = res.locals.user;

    const { tarefa, fim, inicio, descricao, status } = req.body;
    if (!tarefa || !fim || !inicio || !descricao || !status) {
      return res.status(400).send({ message: "payload inválido" });
    }
    const tarefaId = Number(req.params.id);
    const [result] = await db.query(
      "SELECT * FROM tarefas WHERE id=? AND usuarioId=? AND estaDeletado=0",
      [tarefaId, decoded.id]
    );

    const tarefaModificada = result[0];
    if (!tarefaModificada) {
      return res.status(404).send({ message: "Tarefa não existe" });
    }
    await db.query(
      "UPDATE tarefas SET tarefa=?, fim=?, inicio=?, descricao=?, status=? WHERE id=?",
      [tarefa, fim, inicio, descricao, status, tarefaId]
    );
    res.status(200).send();
  } catch (error) {
    console.error("Erro ao atualizar tarefar:", error);
    res.status(500).send({ message: "Erro interno do servidor" });
  }
});

console.log('Estou aqui!')

const PORT = process.env.PORT || port;
app.listen(PORT, () => {
  console.log(`Server ouvindo na porta ${PORT}`);
});
