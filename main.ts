// main.ts
import { MongoClient, ObjectId } from "mongodb";
import {
  UserModel,
  BookModel,
  BorrowModel,
} from "./type.ts";
import {
  validatePhone,
  validateEmail,
  modelToUser,
  modelToBook,
  modelToBorrow,
  periodsOverlap,
} from "./utils.ts";

/* ---------- Conexión Mongo ---------- */
const MONGO_URL = Deno.env.get("MONGO_URL");
if (!MONGO_URL) {
  console.error("MONGO_URL no definido");
  Deno.exit(1);
}

const client = new MongoClient(MONGO_URL);
await client.connect();
console.info("✅ Conectado a MongoDB");

const db = client.db("biblioteca");
const Users  = db.collection<UserModel>("usuarios");
const Books  = db.collection<BookModel>("libros");
const Borrows = db.collection<BorrowModel>("prestamos");

/* ---------- Servidor HTTP ---------- */
const handler = async (req: Request): Promise<Response> => {
  const { pathname, searchParams } = new URL(req.url);
  const method = req.method;

  /* --- GET /usuarios (lista) --- */
  if (method === "GET" && pathname === "/usuarios") {
    const nombre = searchParams.get("nombre");
    const filtro = nombre ? { nombre } : {};
    const usersDB = await Users.find(filtro).toArray();
    const users = await Promise.all(
      usersDB.map((u) => modelToUser(u, Borrows, Books)),
    );
    return json(users);
  }

  /* --- GET /usuario?id={...} --- */
  if (method === "GET" && pathname === "/usuario") {
    const id = searchParams.get("id");
    if (!id) return error("id requerido", 400);
    const userDB = await Users.findOne({ _id: new ObjectId(id) });
    if (!userDB) return error("Usuario no encontrado", 404);
    const user = await modelToUser(userDB, Borrows, Books);
    return json(user);
  }

  /* --- POST /usuarios --- */
  if (method === "POST" && pathname === "/usuarios") {
    const { nombre, telefono, correo, direccion } = await req.json();
    if (!nombre || !telefono || !correo || !direccion) {
      return error("Faltan campos requeridos", 400);
    }
    if (!(await validatePhone(telefono))) return error("Teléfono inválido", 400);
    if (!(await validateEmail(correo)))  return error("Correo inválido", 400);

    const dup = await Users.findOne({ $or: [{ telefono }, { correo }] });
    if (dup) return error("Teléfono o correo duplicado", 400);

    const { insertedId } = await Users.insertOne({
      nombre,
      telefono,
      correo,
      direccion,
    });
    const nuevo = await Users.findOne({ _id: insertedId });
    return json(await modelToUser(nuevo!, Borrows, Books), 201);
  }

  /* --- PUT /usuario --- */
  if (method === "PUT" && pathname === "/usuario") {
    const { id, nombre, telefono, correo, direccion } = await req.json();
    if (!id || !nombre || !telefono || !correo || !direccion) {
      return error("Faltan datos", 400);
    }
    const _id = new ObjectId(id);
    const actual = await Users.findOne({ _id });
    if (!actual) return error("Usuario no encontrado", 404);

    if (telefono !== actual.telefono) {
      if (!(await validatePhone(telefono))) return error("Teléfono inválido", 400);
      const dup = await Users.findOne({ telefono });
      if (dup) return error("Teléfono duplicado", 400);
    }
    if (correo !== actual.correo) {
      if (!(await validateEmail(correo))) return error("Correo inválido", 400);
      const dup = await Users.findOne({ correo });
      if (dup) return error("Correo duplicado", 400);
    }

    await Users.updateOne(
      { _id },
      { $set: { nombre, telefono, correo, direccion } },
    );
    const actualizado = await Users.findOne({ _id });
    return json(await modelToUser(actualizado!, Borrows, Books));
  }

  /* --- DELETE /usuario --- */
  if (method === "DELETE" && pathname === "/usuario") {
    const { id } = await req.json();
    if (!id) return error("id requerido", 400);
    const _id = new ObjectId(id);
    const user = await Users.findOne({ _id });
    if (!user) return error("Usuario no encontrado", 404);

    await Users.deleteOne({ _id });
    await Borrows.deleteMany({ userId: id }); // limpia préstamos del usuario
    return json({ mensaje: "Usuario eliminado" });
  }

  /* ---------- LIBROS ---------- */

  /* GET /libros */
  if (method === "GET" && pathname === "/libros") {
    const librosDB = await Books.find({}).toArray();
    return json(librosDB.map(modelToBook));
  }

  /* POST /libros */
  if (method === "POST" && pathname === "/libros") {
    const { titulo, autor, isbn, anio } = await req.json();
    if (!titulo || !autor || !isbn || !anio) return error("Faltan campos", 400);
    const { insertedId } = await Books.insertOne({ titulo, autor, isbn, anio });
    const libro = await Books.findOne({ _id: insertedId });
    return json(modelToBook(libro!), 201);
  }

  /* ---------- PRÉSTAMOS ---------- */

  /* GET /prestamos */
  if (method === "GET" && pathname === "/prestamos") {
    const prsDB = await Borrows.find({}).toArray();
    const prs = await Promise.all(
      prsDB.map((br) => modelToBorrow(br, Users, Books)),
    );
    return json(prs);
  }

  /* POST /prestamos */
  if (method === "POST" && pathname === "/prestamos") {
    const { userId, bookId, fechaPrestamo, fechaDevolucion } = await req.json();
    if (!userId || !bookId || !fechaPrestamo || !fechaDevolucion) {
      return error("Faltan campos", 400);
    }
    const usuario = await Users.findOne({ _id: new ObjectId(userId) });
    if (!usuario) return error("Usuario no encontrado", 404);
    const libro = await Books.findOne({ _id: new ObjectId(bookId) });
    if (!libro) return error("Libro no encontrado", 404);

    const fIni = new Date(fechaPrestamo);
    const fFin = new Date(fechaDevolucion);
    if (fIni >= fFin) return error("Fechas incorrectas", 400);

    const overlapExists = await Borrows.findOne({ bookId });
    if (overlapExists) {
      const solapado = periodsOverlap(
        new Date(overlapExists.fechaPrestamo),
        new Date(overlapExists.fechaDevolucion),
        fIni,
        fFin,
      );
      if (solapado) return error("Libro ya prestado en esas fechas", 400);
    }

    const { insertedId } = await Borrows.insertOne({
      userId,
      bookId,
      fechaPrestamo,
      fechaDevolucion,
    });
    const prestamo = await Borrows.findOne({ _id: insertedId });
    return json(await modelToBorrow(prestamo!, Users, Books), 201);
  }

  /* DELETE /prestamo */
  if (method === "DELETE" && pathname === "/prestamo") {
    const { id } = await req.json();
    if (!id) return error("id requerido", 400);
    const _id = new ObjectId(id);
    const del = await Borrows.deleteOne({ _id });
    return json({ eliminado: del.deletedCount === 1 });
  }

  /* --- 404 si no coincide ninguna ruta --- */
  return new Response("Not found", { status: 404 });
};

/* ---------- Helpers de respuesta ---------- */
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error = (msg: string, status = 400) =>
  json({ error: msg }, status);

/* ---------- Lanzar servidor ---------- */
Deno.serve({ port: 3000 }, handler);