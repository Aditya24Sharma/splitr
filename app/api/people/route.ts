import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const prisma = getDb()
  const people = await prisma.person.findMany({
    where: { archived: false },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })
  return NextResponse.json(people)
}

export async function POST(req: NextRequest) {
  const prisma = getDb()
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { name, colorHex, isDefault } = body ?? {}

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'name is required and must be a non-empty string' }, { status: 400 })
  }

  const person = await prisma.person.create({
    data: {
      name: name.trim(),
      ...(colorHex !== undefined && { colorHex }),
      ...(isDefault !== undefined && { isDefault }),
    },
  })
  return NextResponse.json(person, { status: 201 })
}
