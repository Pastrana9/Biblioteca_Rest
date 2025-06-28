import { ObjectId, OptionalId } from "mongodb";

/* ---------- Modelos MongoDB ---------- */

export type UserModel = OptionalId<{
  nombre: string;
  telefono: string;
  correo: string;
  direccion: string;
}>;

export type BookModel = OptionalId<{
  titulo: string;
  autor: string;
  isbn: string;
  anio: number;
}>;

export type BorrowModel = OptionalId<{
  userId: string;         // ObjectId stringify
  bookId: string;         // ObjectId stringify
  fechaPrestamo: string;  // ISO‑8601
  fechaDevolucion: string;
}>;

/* ---------- Tipos que enviaremos en las respuestas ---------- */

export type User = {
  id: string;
  nombre: string;
  telefono: string;
  correo: string;
  direccion: string;
  prestamos: BorrowResumido[];
};

export type Book = {
  id: string;
  titulo: string;
  autor: string;
  isbn: string;
  anio: number;
};

export type Borrow = {
  id: string;
  usuario: UserMini;
  libro: BookMini;
  fechaPrestamo: string;
  fechaDevolucion: string;
};

export type BorrowResumido = {
  id: string;
  libro: BookMini;
  fechaPrestamo: string;
  fechaDevolucion: string;
};

export type UserMini = { id: string; nombre: string };
export type BookMini = { id: string; titulo: string };
