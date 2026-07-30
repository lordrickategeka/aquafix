import { NextResponse } from "next/server";

export function success(data, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function fail(message, status = 400, errors) {
  return NextResponse.json(
    { error: message, ...(errors ? { errors } : {}) },
    { status },
  );
}
