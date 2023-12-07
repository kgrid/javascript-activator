import { Status } from "./deps.ts";

export class EndpointNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EndpointNotFoundError";
  }
  status = Status.NotFound; //404
}

export class KONotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KONotFoundError";
  }
  status = Status.NotFound; //404
}

export class FileNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileNotFoundError";
  }
  status = Status.NotFound; //404
}

export class InvalidInputParameterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInputParameterError";
  }
  status = Status.InternalServerError; //500
}

