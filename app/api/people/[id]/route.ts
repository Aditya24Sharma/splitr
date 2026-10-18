import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, colorHex, isDefault, archived } = body ?? {}

  const data: Record<string, unknown> = {}
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 })
    }
    data.name = name.trim()
  }
  if (colorHex !== undefined) data.colorHex = colorHex
  if (isDefault !== undefined) data.isDefault = isDefault
  if (archived !== undefined) data.archived = archived

  try {
    const person = await prisma.person.update({ where: { id }, data })
    return NextResponse.json(person)
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }
    throw e
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const person = await prisma.person.update({
      where: { id },
      data: { archived: true },
    })
    return NextResponse.json(person)
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }
    throw e
  }
}
