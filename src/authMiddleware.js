import { privateKey } from "./constantes.js";
import jwt from "jsonwebtoken";

function verifyJwt(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, privateKey, (error, decoded) =>
      error ? reject(new Error("Token inválido")) : resolve(decoded)
    );
  });
}

export default async function authMiddleware(req, res, next) {
  try {
    const bearerToken = req.headers.authorization;
    const token = bearerToken.replace("Bearer ", "");
    if (!token) return res.status(401).send("token inválido");
    const decoded = await verifyJwt(token);
    console.log(decoded);
    res.locals.user = decoded;
    next();
  } catch (error) {
    res.status(401).send("token inválido");
  }
}
