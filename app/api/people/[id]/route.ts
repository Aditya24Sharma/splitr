import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getDb } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = getDb()
  const { id } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, colorHex, isDefault, isMe, archived } = body ?? {}

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
  if (isMe !== undefined) {
    if (typeof isMe !== 'boolean') {
      return NextResponse.json({ error: 'isMe must be a boolean' }, { status: 400 })
    }
    data.isMe = isMe
  }

  try {
    // Update this person first, so a bad id fails before anyone else changes
    const person = await prisma.person.update({ where: { id }, data })
    // Only one person can be you
    if (isMe === true) await prisma.person.updateMany({ where: { id: { not: id } }, data: { isMe: false } })
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
  const prisma = getDb()
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
