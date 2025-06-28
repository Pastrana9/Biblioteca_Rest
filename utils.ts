import { Collection, ObjectId } from "mongodb";
import {
  UserModel,
  BookModel,
  BorrowModel,
  User,
  Book,
  Borrow,
  BorrowResumido,
  UserMini,
  BookMini,
} from "./type.ts";

/* ---------- Validación externa vía API Ninjas ---------- */

const API_KEY = Deno.env.get("API_KEY");
if (!API_KEY) throw new Error("Falta API_KEY");

const fetchApi = async (url: string) => {
  const res = await fetch(url, { headers: { "X-Api-Key": API_KEY } });
  if (res.status !== 200) throw new Error("Fallo en API Ninjas");
  return res.json();
};

export const validatePhone = async (telefono: string) => {
  const data = await fetchApi(
    `https://api.api-ninjas.com/v1/validatephone?number=${telefono}`,
  );
  return data.is_valid as boolean;
};

export const validateEmail = async (correo: string) => {
  const data = await fetchApi(
    `https://api.api-ninjas.com/v1/validateemail?email=${correo}`,
  );
  return data.is_valid as boolean;
};

/* ---------- Helpers de conversión de modelos a DTO ---------- */

export const toBookMini = (b: BookModel): BookMini => ({
  id: b._id!.toString(),
  titulo: b.titulo,
});

export const toUserMini = (u: UserModel): UserMini => ({
  id: u._id!.toString(),
  nombre: u.nombre,
});

export const modelToBook = (b: BookModel): Book => ({
  id: b._id!.toString(),
  titulo: b.titulo,
  autor: b.autor,
  isbn: b.isbn,
  anio: b.anio,
});

export const modelToBorrowResumido = async (
  br: BorrowModel,
  booksCol: Collection<BookModel>,
): Promise<BorrowResumido> => {
  const libro = await booksCol.findOne({ _id: new ObjectId(br.bookId) });
  return {
    id: br._id!.toString(),
    libro: libro ? toBookMini(libro) : { id: br.bookId, titulo: "Desconocido" },
    fechaPrestamo: br.fechaPrestamo,
    fechaDevolucion: br.fechaDevolucion,
  };
};

export const modelToUser = async (
  u: UserModel,
  borrowsCol: Collection<BorrowModel>,
  booksCol: Collection<BookModel>,
): Promise<User> => {
  const prestamosDB = await borrowsCol
    .find({ userId: u._id!.toString() })
    .toArray();
  const prestamos = await Promise.all(
    prestamosDB.map((br) => modelToBorrowResumido(br, booksCol)),
  );
  return {
    id: u._id!.toString(),
    nombre: u.nombre,
    telefono: u.telefono,
    correo: u.correo,
    direccion: u.direccion,
    prestamos,
  };
};

export const modelToBorrow = async (
  br: BorrowModel,
  usersCol: Collection<UserModel>,
  booksCol: Collection<BookModel>,
): Promise<Borrow> => {
  const usuario = await usersCol.findOne({ _id: new ObjectId(br.userId) });
  const libro = await booksCol.findOne({ _id: new ObjectId(br.bookId) });
  return {
    id: br._id!.toString(),
    usuario: usuario ? toUserMini(usuario) : { id: br.userId, nombre: "N/A" },
    libro: libro ? toBookMini(libro) : { id: br.bookId, titulo: "N/A" },
    fechaPrestamo: br.fechaPrestamo,
    fechaDevolucion: br.fechaDevolucion,
  };
};

/* ---------- Overlap fechas ---------- */
export const periodsOverlap = (
  aIni: Date,
  aFin: Date,
  bIni: Date,
  bFin: Date,
) => aIni <= bFin && bIni <= aFin;
