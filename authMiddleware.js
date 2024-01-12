import { privateKey } from "./constantes.js";
import jwt from "jsonwebtoken";

export default function authMiddleware(req, res, next) {
  const bearerToken = req.headers.authorization;
  const token = bearerToken.replace("Bearer ", "");
  if (!token) return res.status(401);
  const decoded = jwt.verify(token, privateKey);
  res.locals.user = decoded;
  next();
}
